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
import "../../third_party/aave/IAToken.sol";
import "../../third_party/aave/ILendingPool.sol";
import "../../third_party/aave/IAaveIncentivesController.sol";
import "../../third_party/aave/IProtocolDataProvider.sol";

/// @title Contract for RadiantV2 simple supply strategy simplified
/// @author belbix, Aleh
abstract contract Radiant2StrategyBase is UniversalLendStrategy {
  using SafeERC20 for IERC20;

  /// ******************************************************
  ///                Constants and variables
  /// ******************************************************

  /// @notice Version of the contract
  /// @dev Should be incremented when contract changed
  string public constant VERSION = "1.0.1";

  IStrategy.Platform public constant override platform = IStrategy.Platform.RADIANT2;
  /// @notice Strategy type for statistical purposes
  string public constant override STRATEGY_NAME = "Radiant2StrategyBase";

  ILendingPool public constant AAVE_LENDING_POOL = ILendingPool(0xd50Cf00b6e600Dd036Ba8eF475677d816d6c4281);
  IProtocolDataProvider public constant AAVE_DATA_PROVIDER = IProtocolDataProvider(0x2f9D57E97C3DFED8676e605BC504a48E0c5917E9);


  /// ******************************************************
  ///                    Initialization
  /// ******************************************************

  /// @notice Initialize contract after setup it as proxy implementation
  function initializeStrategy(
    address controller_,
    address underlying_,
    address vault_,
    uint buybackRatio_
  ) public initializer {
    UniversalLendStrategy.initializeLendStrategy(
      controller_,
      underlying_,
      vault_,
      buybackRatio_,
      new address[](0)
    );

    address aToken;
    (aToken,,) = AAVE_DATA_PROVIDER.getReserveTokensAddresses(underlying_);
    require(IAToken(aToken).UNDERLYING_ASSET_ADDRESS() == _underlying(), "Wrong underlying");
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
    uint[] memory rewards = new uint256[](1);
    return rewards;
  }

  /// @notice TVL of the underlying in the pool
  function poolTotalAmount() external view override returns (uint256) {
    address aToken;
    (aToken,,) = AAVE_DATA_PROVIDER.getReserveTokensAddresses(_underlying());
    return IERC20(_underlying()).balanceOf(aToken);
  }

  /// ******************************************************
  ///              Internal logic implementation
  /// ******************************************************


  /// @dev Refresh rates and return actual deposited balance in underlying tokens
  function _getActualPoolBalance() internal view override returns (uint) {
    (uint suppliedUnderlying,,,,,,,,) = AAVE_DATA_PROVIDER.getUserReserveData(_underlying(), address(this));
    return suppliedUnderlying;
  }

  /// @dev Deposit to pool and increase local balance
  function _simpleDepositToPool(uint amount) internal override {
    address u = _underlying();
    _approveIfNeeds(u, amount, address(AAVE_LENDING_POOL));
    AAVE_LENDING_POOL.deposit(u, amount, address(this), 0);
  }

  /// @dev Perform only withdraw action, without changing local balance
  function _withdrawFromPoolWithoutChangeLocalBalance(uint amount, uint poolBalance) internal override returns (bool withdrewAll, uint withdrawnAmount) {
    address u = _underlying();
    uint underlyingBalanceBefore = IERC20(u).balanceOf(address(this));
    if (amount < poolBalance) {
      withdrewAll = false;
      AAVE_LENDING_POOL.withdraw(u, amount, address(this));
    } else {
      withdrewAll = true;
      AAVE_LENDING_POOL.withdraw(u, type(uint).max, address(this));
    }
    uint underlyingBalanceAfter = IERC20(u).balanceOf(address(this));
    withdrawnAmount = underlyingBalanceAfter - underlyingBalanceBefore;
  }

  /// @dev Withdraw all and set localBalance to zero
  function _withdrawAllFromPool() internal override {
    AAVE_LENDING_POOL.withdraw(_underlying(), type(uint).max, address(this));
  }

  /// @dev Claim distribution rewards
  function _claimReward() internal override {
    // no rewards for the simple supply
  }

  //slither-disable-next-line unused-state
  uint256[49] private ______gap;
}
