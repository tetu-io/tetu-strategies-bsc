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

import "../UniversalLendStrategy.sol";

import "../../third_party/wombex/IPoolDepositor.sol";
import "../../third_party/wombex/IAsset.sol";
import "../../third_party/wombex/IWmxClaimZap.sol";
import "../../third_party/wombex/IBaseRewardPool4626.sol";
import "../../third_party/wombex/IPool.sol";

/// @title Contract for Wombex simple supply strategy simplified
/// @author Aleh
abstract contract WombexStrategyBase is UniversalLendStrategy {
  using SafeERC20 for IERC20;

  /// ******************************************************
  ///                Constants and variables
  /// ******************************************************

  /// @notice Version of the contract
  /// @dev Should be incremented when contract changed
  string public constant VERSION = "1.0.0";

  IStrategy.Platform public constant override platform = IStrategy.Platform.SLOT_49; //todo change
  /// @notice Strategy type for statistical purposes
  string public constant override STRATEGY_NAME = "WombexStrategyBase";

  IPoolDepositor public constant POOL_DEPOSITOR = IPoolDepositor(0xc2Ee2ab275BC3F38cA30E902211640D8bB58C4d1);
  address public constant WOM_TOKEN = 0xAD6742A35fB341A9Cc6ad674738Dd8da98b94Fb1;
  address public constant WMX_TOKEN = 0xa75d9ca2a0a1D547409D82e1B06618EC284A2CeD;

  uint public constant PRICE_IMPACT = 50; // 0.5%
  uint public constant PRICE_IMPACT_PRECISION = 1000;

  IAsset public lpToken;
  address public wmxLP;

  /// ******************************************************
  ///                    Initialization
  /// ******************************************************

  /// @notice Initialize contract after setup it as proxy implementation
  function initializeStrategy(
    address controller_,
    address underlying_,
    address lpToken_,
    address wmxLP_,
    address vault_,
    uint buybackRatio_
  ) public initializer {

    address [] memory rewardTokens = new address[](2);
    rewardTokens[0] = WOM_TOKEN;
    rewardTokens[1] = WMX_TOKEN;

    UniversalLendStrategy.initializeLendStrategy(
      controller_,
      underlying_,
      vault_,
      buybackRatio_,
      rewardTokens
    );

    lpToken = IAsset(lpToken_);
    wmxLP = wmxLP_;
    require(lpToken.underlyingToken() == _underlying(), "Wrong underlying");
  }

  /// ******************************************************
  ///                    Views
  /// ******************************************************

  /// @notice Invested assets in the pool
  function _rewardPoolBalance() internal override view returns (uint) {
    return localBalance;
  }

  /// @notice Return approximately amount of reward tokens ready to claim
  function readyToClaim() external pure override returns (uint[] memory) {
    uint[] memory rewards = new uint256[](2);
    return rewards;
  }

  /// @notice TVL of the underlying in the pool
  function poolTotalAmount() external view override returns (uint256) {
    return lpToken.underlyingTokenBalance();
  }

  /// ******************************************************
  ///              Internal logic implementation
  /// ******************************************************

  /// @dev Refresh rates and return actual deposited balance in underlying tokens
  function _getActualPoolBalance() internal view override returns (uint) {
    uint lpBalance = IBaseRewardPool4626(wmxLP).balanceOf(address(this));
    (uint res,) = POOL_DEPOSITOR.getWithdrawAmountOut(address(lpToken), _underlying(), lpBalance);
    return res;
  }

  /// @dev Deposit to pool and increase local balance
  function _simpleDepositToPool(uint amount) internal override {
    address u = _underlying();
    _approveIfNeeds(u, amount, address(POOL_DEPOSITOR));
    uint minLiquidity = amount * (PRICE_IMPACT_PRECISION - PRICE_IMPACT) / PRICE_IMPACT_PRECISION;
    POOL_DEPOSITOR.deposit(address(lpToken), amount, minLiquidity, block.timestamp + 1, true);
  }

  /// @dev Perform only withdraw action, without changing local balance
  function _withdrawFromPoolWithoutChangeLocalBalance(uint amount, uint poolBalance) internal override returns (bool withdrewAll, uint withdrawnAmount) {
    uint minAmountOut = amount * (PRICE_IMPACT_PRECISION - PRICE_IMPACT) / PRICE_IMPACT_PRECISION;

    (uint lpAmount, uint reward) = POOL_DEPOSITOR.getDepositAmountOut(address(lpToken), amount);
    lpAmount += reward;

    uint lpAmountTotal = IBaseRewardPool4626(wmxLP).balanceOf(address(this));

    lpAmount = Math.min(lpAmountTotal, lpAmount);
    address u = _underlying();
    uint underlyingBalanceBefore = IERC20(u).balanceOf(address(this));
    _approveIfNeeds(wmxLP, lpAmount, address(POOL_DEPOSITOR));
    if (amount < poolBalance) {
      POOL_DEPOSITOR.withdraw(address(lpToken), lpAmount, minAmountOut, block.timestamp + 1, address(this));
      withdrewAll = false;
    } else {
      POOL_DEPOSITOR.withdraw(address(lpToken), lpAmount, minAmountOut, block.timestamp + 1, address(this));
      withdrewAll = true;
    }
    uint underlyingBalanceAfter = IERC20(u).balanceOf(address(this));
    withdrawnAmount = underlyingBalanceAfter - underlyingBalanceBefore;
  }

  /// @dev Withdraw all and set localBalance to zero
  function _withdrawAllFromPool() internal override {
    uint lpAmount = IBaseRewardPool4626(wmxLP).balanceOf(address(this));
    _approveIfNeeds(wmxLP, lpAmount, address(POOL_DEPOSITOR));
    (uint underlyingAmount, ) = POOL_DEPOSITOR.getWithdrawAmountOut(address(lpToken), _underlying(), lpAmount);
    uint minAmountOut = underlyingAmount * (PRICE_IMPACT_PRECISION - PRICE_IMPACT) / PRICE_IMPACT_PRECISION;
    POOL_DEPOSITOR.withdrawFromOtherAsset(address(lpToken), _underlying(), lpAmount, minAmountOut, block.timestamp + 1, address(this));

  }

  /// @dev Claim distribution rewards
  function _claimReward() internal override {
    IBaseRewardPool4626(wmxLP).getReward();
  }

  //slither-disable-next-line unused-state
  uint256[49] private ______gap;
}
