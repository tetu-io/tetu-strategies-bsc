// SPDX-License-Identifier: ISC
/**
* By using this software, you understand, acknowledge and accept that Tetu
* and/or the underlying software are provided “as is” and “as available”
* basis and without warranties or representations of any kind either expressed
* or implied. Any use of this open source software released under the ISC
* Internet Systems Consortium license is done at your own risk to the fullest
* extent permissible pursuant to applicable law any and all liability as well
* as all warranties, including any fitness for a particular purpose with respect
* to Tetu and/or the underlying software and the use thereof are disclaimed.
*/
pragma solidity 0.8.4;

import "@tetu_io/tetu-contracts/contracts/base/strategies/ProxyStrategyBase.sol";
import "../../interface/ITetuLiquidator.sol";
import "../../third_party/IERC20Extended.sol";
import "./IConeStacker.sol";
import "../../third_party/cone/IGauge.sol";
import "../../third_party/cone/IMultiRewardsPool.sol";
import "../../third_party/cone/IPair.sol";
import "../../third_party/cone/IRouter.sol";

/// @title Strategy for autocompound Cone rewards
/// @author belbix
abstract contract ConeStrategyBase is ProxyStrategyBase {
  using SafeERC20 for IERC20;

  // --------------------- CONSTANTS -------------------------------
  /// @notice Strategy type for statistical purposes
  string public constant override STRATEGY_NAME = "ConeStrategyBase";
  /// @notice Version of the contract
  /// @dev Should be incremented when contract changed
  string public constant VERSION = "1.0.3";

  uint private constant PRICE_IMPACT_TOLERANCE = 10_000;
  address private constant CONE = 0xA60205802E1B5C6EC1CAFA3cAcd49dFeECe05AC9;
  IRouter private constant CONE_ROUTER = IRouter(0xbf1fc29668e5f5Eaa819948599c9Ac1B1E03E75F);
  ITetuLiquidator private constant TETU_LIQUIDATOR = ITetuLiquidator(0xcE9F7173420b41678320cd4BB93517382b6D48e8);
  uint private constant _DUST = 10_000;


  // ------------------- VARIABLES ---------------------------------
  IConeStacker public coneStacker;
  address public gauge;
  uint public accumulatePOLRatio;
  uint claimBribeCounter;

  /// @notice Initialize contract after setup it as proxy implementation
  function initializeStrategy(
    address _controller,
    address _vault,
    address _gauge,
    address _coneStacker
  ) public initializer {
    address underlying = ISmartVault(_vault).underlying();
    coneStacker = IConeStacker(_coneStacker);
    gauge = _gauge;
    accumulatePOLRatio = 100;

    ProxyStrategyBase.initializeStrategyBase(
      _controller,
      underlying,
      _vault,
      new address[](0),
      50_00
    );
  }

  /// --- GOV ACTIONS

  /// @dev Percent of accumulating Protocol Owned Liquidity.
  function setAccumulatePOLRatio(uint value) external restricted {
    require(value <= 100, "max");
    accumulatePOLRatio = value;
  }

  /// @dev Compound dust to underlying
  function manualCompound() external hardWorkers {
    address und = _underlying();
    (address token0, address token1) = IPair(und).tokens();

    _compound(IERC20(token0).balanceOf(address(this)), und, token0);
    _compound(IERC20(token1).balanceOf(address(this)), und, token1);
    _investAllUnderlying();
  }

  /// --- MAIN LOGIC

  /// @dev Returns underlying amount under control
  function _rewardPoolBalance() internal override view returns (uint) {
    return coneStacker.userBalance(gauge, address(this));
  }

  /// @dev empty array
  function readyToClaim() external pure override returns (uint[] memory) {
    return new uint[](0);
  }

  /// @dev Return full pool TVL
  function poolTotalAmount() external view override returns (uint) {
    return IMultiRewardsPool(gauge).totalSupply();
  }

  /// @dev Collect profit and do something useful with them
  function doHardWork() external override virtual hardWorkers onlyNotPausedInvesting {
    _doHardWork(false);
  }

  function _doHardWork(bool silent) internal {
    // always silent for vault actions
    if (msg.sender == _vault()) {
      silent = true;
    }
    if (silent) {
      try this._doHardWorkInternal() {} catch {}
    } else {
      _doHardWorkInternal();
    }
  }

  // public for calling in try catch
  function _doHardWorkInternal() public hardWorkers onlyNotPausedInvesting {

    IConeStacker _coneStacker = coneStacker;
    // we can not claim rewards with zero balance in the stacker contract
    if (_coneStacker.userBalance(gauge, address(this)) != 0) {
      // make useful things with tokens
      liquidateReward();
    }
    _coneStacker.lock(0, true);
  }

  /// @dev Stake underlying
  function depositToPool(uint amount) internal override {
    if (amount > 0) {
      address und = _underlying();
      IConeStacker _coneStacker = coneStacker;
      IERC20(und).safeTransfer(address(_coneStacker), amount);
      _coneStacker.depositToGauge(und, gauge, amount);
    }
  }

  /// @dev Withdraw underlying
  function withdrawAndClaimFromPool(uint underlyingAmount) internal override {
    _doHardWork(true);
    if (underlyingAmount > 0) {
      coneStacker.withdrawFromGauge(_underlying(), gauge, underlyingAmount);
    }
  }

  /// @dev Withdraw without care about rewards
  function emergencyWithdrawFromPool() internal override {
    uint balance = _rewardPoolBalance();
    if (balance > 0) {
      coneStacker.withdrawFromGauge(_underlying(), gauge, balance);
    }
  }

  function liquidateReward() internal override {
    IController ctrl = IController(_controller());
    address forwarder = ctrl.feeRewardForwarder();

    address[] memory rts;

    {// create array for reward tokens and claim
      uint _claimBribeCounter = claimBribeCounter;

      IMultiRewardsPool _gauge = IMultiRewardsPool(gauge);
      IMultiRewardsPool _bribe = IMultiRewardsPool(IGauge(address(_gauge)).bribe());
      uint256 gaugeRtsLength = _gauge.rewardTokensLength();
      uint256 bribeRtsLength = _bribe.rewardTokensLength();

      // claim bribes only once per 30 calls
      if (_claimBribeCounter > 30) {
        claimBribeCounter = 0;
      } else {
        claimBribeCounter = _claimBribeCounter + 1;
        bribeRtsLength = 0;
      }

      uint rewardCount;
      address[] memory gaugeRts = new address[](gaugeRtsLength);
      address[] memory bribeRts = new address[](bribeRtsLength);
      rts = new address[](gaugeRtsLength + bribeRtsLength);
      for (uint i; i < gaugeRtsLength; ++i) {
        rts[rewardCount] = _gauge.rewardTokens(i);
        gaugeRts[i] = rts[rewardCount];
        rewardCount++;
      }
      for (uint i; i < bribeRtsLength; ++i) {
        rts[rewardCount] = _bribe.rewardTokens(i);
        bribeRts[i] = rts[rewardCount];
        rewardCount++;
      }

      coneStacker.claim(address(_gauge), gaugeRts, bribeRts);
    }

    address und = _underlying();
    uint bbRatio = _buyBackRatio();
    address vault = _vault();

    uint targetTokenEarnedTotal = 0;
    for (uint i = 0; i < rts.length; i++) {
      address rt = rts[i];
      uint amount = IERC20(rt).balanceOf(address(this));
      if (amount > _DUST) {

        uint toBb = amount * bbRatio / _BUY_BACK_DENOMINATOR;
        uint toCompound = amount - toBb;

        if (toBb > _DUST) {
          uint toPol = toBb * accumulatePOLRatio / 100;
          uint toDistribute = toBb - toPol;
          if (toPol > _DUST) {
            _pol(toPol, rt);
          }
          if (toDistribute > _DUST) {
            _approveIfNeeds(rt, toDistribute, forwarder);
            targetTokenEarnedTotal += IFeeRewardForwarder(forwarder).distribute(toDistribute, rt, vault);
          }
        }

        if (toCompound > _DUST) {
          _compound(toCompound, und, rt);
        }
      }
    }

    if (targetTokenEarnedTotal > 0) {
      IBookkeeper(ctrl.bookkeeper()).registerStrategyEarned(targetTokenEarnedTotal);
    }
  }

  function _compound(uint toCompound, address und, address rt) internal {
    if (toCompound == 0) {
      return;
    }

    (address token0, address token1) = IPair(und).tokens();
    bool isStable = IPair(und).stable();

    uint amountFor0;
    if (isStable) {
      (uint reserve0, uint reserve1) = _normalizedReserves(und, token0, token1);
      amountFor0 = toCompound * reserve0 / (reserve0 + reserve1);
    } else {
      amountFor0 = toCompound / 2;
    }
    uint amountFor1 = toCompound - amountFor0;

    uint amount0;
    uint amount1;

    _approveIfNeeds(rt, toCompound, address(TETU_LIQUIDATOR));

    if (rt != token0) {
      _liquidate(rt, token0, amountFor0);
      amount0 = IERC20(token0).balanceOf(address(this));
    } else {
      amount0 = amountFor0;
    }

    if (rt != token1) {
      _liquidate(rt, token1, amountFor1);
      amount1 = IERC20(token1).balanceOf(address(this));
    } else {
      amount1 = amountFor1;
    }

    if (amount0 > _DUST && amount1 > _DUST) {
      _approveIfNeeds(token0, amount0, address(CONE_ROUTER));
      _approveIfNeeds(token1, amount1, address(CONE_ROUTER));
      CONE_ROUTER.addLiquidity(
        token0,
        token1,
        isStable,
        amount0,
        amount1,
        0,
        0,
        address(this),
        block.timestamp
      );
    }
  }

  function _normalizedReserves(address pair, address token0, address token1) internal view returns (uint, uint){
    (uint reserve0, uint reserve1,) = IPair(pair).getReserves();
    uint decimals0 = IERC20Extended(token0).decimals();
    uint decimals1 = IERC20Extended(token1).decimals();
    return (reserve0 * 1e18 / 10 ** decimals0, reserve1 * 1e18 / 10 ** decimals1);
  }

  function _pol(uint amount, address rt) internal {
    if (amount != 0) {
      uint toInvest = amount;
      if (rt != CONE) {
        uint balanceBefore = IERC20(CONE).balanceOf(address(this));
        _approveIfNeeds(rt, amount, address(TETU_LIQUIDATOR));
        _liquidate(rt, CONE, amount);
        toInvest = IERC20(CONE).balanceOf(address(this)) - balanceBefore;
      }
      if (toInvest > _DUST) {
        IERC20(CONE).safeTransfer(address(coneStacker), toInvest);
        coneStacker.lock(toInvest, false);
      }
    }
  }

  function _liquidate(address tokenIn, address tokenOut, uint amount) internal {
    (ITetuLiquidator.PoolData[] memory route, string memory errorMessage) =
    TETU_LIQUIDATOR.buildRoute(tokenIn, tokenOut);

    if (route.length == 0) {
      revert (errorMessage);
    }

    uint amountOut;
    try TETU_LIQUIDATOR.getPriceForRoute(route, amount) returns (uint out) {
      amountOut = out;
    } catch {}

    if (amountOut > _DUST) {
      TETU_LIQUIDATOR.liquidateWithRoute(route, amount, PRICE_IMPACT_TOLERANCE);
    }
  }

  /// @dev Platform name for statistical purposes
  /// @return Platform enum index
  function platform() external override pure returns (Platform) {
    return Platform.SLOT_41;
  }

  function _approveIfNeeds(address token, uint amount, address spender) internal {
    if (IERC20(token).allowance(address(this), spender) < amount) {
      IERC20(token).safeApprove(spender, 0);
      IERC20(token).safeApprove(spender, type(uint).max);
    }
  }

  //slither-disable-next-line unused-state
  uint256[46] private ______gap;
}
