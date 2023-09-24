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
import "../interfaces/ITetuLiquidator.sol";

/// @title Universal base strategy for simple lending
/// @author Aleh
abstract contract UniversalLendStrategy is ProxyStrategyBase {
  using SafeERC20 for IERC20;

  /// ******************************************************
  ///                Constants and variables
  /// ******************************************************
  uint private constant _DUST = 10_000;
  address private constant _PERF_FEE_TREASURY = 0x5256B9276974B12501e3caE24f877357ceBddDD2;
  ITetuLiquidator public constant TETU_LIQUIDATOR = ITetuLiquidator(0xcE9F7173420b41678320cd4BB93517382b6D48e8);
  uint private constant PRICE_IMPACT_TOLERANCE = 10_000;

  uint internal localBalance;
  uint public lastHw;

  ////////////////////// GAP ///////////////////////////
  //slither-disable-next-line unused-state
  uint256[48] private ______gap;
  //////////////////////////////////////////////////////

  /// ******************************************************
  ///                    Initialization
  /// ******************************************************

  /// @notice Initialize contract after setup it as proxy implementation
  function initializeLendStrategy(
    address controller_,
    address underlying_,
    address vault_,
    uint buybackRatio_,
    address[] memory __rewardTokens
  ) public initializer {
    ProxyStrategyBase.initializeStrategyBase(
      controller_,
      underlying_,
      vault_,
      __rewardTokens,
      buybackRatio_
    );
  }

  // *******************************************************
  //                      GOV ACTIONS
  // *******************************************************

  /// @dev Set new reward tokens
  function setRewardTokens(address[] memory rts) external restricted {
    delete _rewardTokens;
    for (uint i = 0; i < rts.length; i++) {
      _rewardTokens.push(rts[i]);
      _unsalvageableTokens[rts[i]] = true;
    }
  }

  /// ******************************************************
  ///              Do hard work
  /// ******************************************************

  function doHardWork() external onlyNotPausedInvesting override hardWorkers {
    _preHardWorkHook();
    _doHardWork(false, true);
  }

  /// ******************************************************
  ///              Specific Internal logic
  /// ******************************************************

  /// @dev Deposit to pool and increase local balance
  function _simpleDepositToPool(uint amount) internal virtual;

  /// @dev Refresh rates and return actual deposited balance in underlying tokens
  function _getActualPoolBalance() internal virtual returns (uint);

  /// @dev Perform only withdraw action, without changing local balance
  function _withdrawFromPoolWithoutChangeLocalBalance(uint amount, uint poolBalance) internal virtual returns (bool withdrewAll, uint withdrawnAmount);

  /// @dev Withdraw all and set localBalance to zero
  function _withdrawAllFromPool() internal virtual;

  /// @dev Claim all possible rewards to the current contract
  function _claimReward() internal virtual;

  function _preHardWorkHook() internal virtual {
  }

  /// ******************************************************
  ///              Internal logic implementation
  /// ******************************************************

  /// @dev Deposit underlying to the pool
  /// @param amount Deposit amount
  function depositToPool(uint256 amount) internal override {
    address u = _underlying();
    amount = Math.min(IERC20(u).balanceOf(address(this)), amount);
    if (amount > 0) {
      _simpleDepositToPool(amount);
      localBalance += amount;
    }
  }

  /// @dev Withdraw underlying from the pool
  function withdrawAndClaimFromPool(uint256 amount_) internal override {
    uint poolBalance = _doHardWork(true, false);
    (bool withdrewAll, uint withdrawn) = _withdrawFromPoolWithoutChangeLocalBalance(amount_, poolBalance);
    if (withdrewAll) {
      localBalance = 0;
    } else {
      localBalance > amount_ ? localBalance -= withdrawn : localBalance = 0;
    }
  }

  /// @dev Exit from external project without caring about rewards, for emergency cases only
  function emergencyWithdrawFromPool() internal override {
    _withdrawAllFromPool();
    localBalance = 0;
  }

  function liquidateReward() internal override {
    // noop
  }

  /// @dev assets should reflect underlying tokens need to investing
  function assets() external override view returns (address[] memory) {
    address[] memory arr = new address[](1);
    arr[0] = _underlying();
    return arr;
  }

  function _claimAndLiquidate(bool silent) internal{
    address und = _underlying();
    uint underlyingBalance = IERC20(und).balanceOf(address(this));
    _claimReward();
    address[] memory rts = _rewardTokens;
    for (uint i; i < rts.length; ++i) {
      address rt = rts[i];
      uint amount = IERC20(rt).balanceOf(address(this));
      if (und == rt) {
        // if claimed underlying exclude what we had before the claim
        amount = amount - underlyingBalance;
      }
      if (amount > _DUST) {
        _approveIfNeeds(rt, amount, address(TETU_LIQUIDATOR));
        if (und != rt) {
          if (silent) {
            try TETU_LIQUIDATOR.liquidate(rt, und, amount, PRICE_IMPACT_TOLERANCE) {} catch {}
          } else {
            TETU_LIQUIDATOR.liquidate(rt, und, amount, PRICE_IMPACT_TOLERANCE);
          }
        }
        underlyingBalance = IERC20(und).balanceOf(address(this));
      }
    }
    if (underlyingBalance != 0) {
      _simpleDepositToPool(underlyingBalance);
    }
  }

  /// @dev Algorithm: we using local balance to calculate profit. There are 2 sources of profit:
  // 1. Profit from supplied underlying tokens
  // 2. Profit from reward tokens
  // We swapping all reward tokens to underlying and add to the pool (supply). Then we calculate the profit based on the
  // difference between the local balance and the current pool balance.
  // Strategy withdraws portion of this profit and sends to the _PERF_FEE_TREASURY and updates local balance.
  function _doHardWork(bool silent, bool push) internal returns (uint) {
    uint _lastHw = lastHw;

    if (!push && _lastHw != 0 && (block.timestamp - _lastHw) < 12 hours) {
      return _getActualPoolBalance();
    }
    lastHw = block.timestamp;

    address u = _underlying();
    IController c = IController(_controller());
    _claimAndLiquidate(silent);
    uint poolBalance = _getActualPoolBalance();
    uint _localBalance = localBalance;

    if (poolBalance != 0 && poolBalance > _localBalance) {
      uint profit = poolBalance - _localBalance;
      // protection if something went wrong
      require(_localBalance < _DUST || profit < poolBalance / 20, 'Too huge profit');

      uint toBuybacks = _calcToBuyback(profit, _localBalance);

      if (toBuybacks > _DUST) {
        // if no users, withdraw all and send to controller for remove dust from this contract
        if (toBuybacks == poolBalance) {
          _withdrawAllFromPool();
          localBalance = 0;
          IERC20(u).safeTransfer(address(c), IERC20(u).balanceOf(address(this)));
        } else {
          (bool withdrewAll, uint withdrawnAmount) = _withdrawFromPoolWithoutChangeLocalBalance(toBuybacks, poolBalance);
          if (withdrewAll) {
            localBalance = 0;
          }
          IERC20(u).safeTransfer(_PERF_FEE_TREASURY, withdrawnAmount);
          uint remaining = profit - withdrawnAmount; // need to use real withdrawn amount instead of toBuybacks
          if (remaining != 0) {
            localBalance += remaining;
          }
        }
      }

    }
    IBookkeeper(c.bookkeeper()).registerStrategyEarned(0);
    return poolBalance;
  }

  /// ******************************************************
  ///                       Utils
  /// ******************************************************

  function _approveIfNeeds(address token, uint amount, address spender) internal {
    if (IERC20(token).allowance(address(this), spender) < amount) {
      IERC20(token).safeApprove(spender, 0);
      IERC20(token).safeApprove(spender, type(uint).max);
    }
  }

  function _calcToBuyback(uint amount, uint _localBalance) internal view returns (uint) {
    if (_localBalance == 0) {
      // move all profit to buybacks if no users
      return amount;
    } else {
      return amount * _buyBackRatio() / _BUY_BACK_DENOMINATOR;
    }
  }
}
