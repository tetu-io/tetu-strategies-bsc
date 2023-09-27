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
import "../../third_party/venus/IUnitroller.sol";
import "../../third_party/venus/IVToken.sol";

/// @title Contract for Venus strategy
/// @author Aleh
abstract contract VenusSupplyStrategyBase is UniversalLendStrategy {
  using SafeERC20 for IERC20;

  /// ******************************************************
  ///                Constants and variables
  /// ******************************************************

  /// @notice Version of the contract
  /// @dev Should be incremented when contract changed
  string public constant VERSION = "1.0.2";

  IStrategy.Platform public constant override platform = IStrategy.Platform.SLOT_47; // todo change
  /// @notice Strategy type for statistical purposes
  string public constant override STRATEGY_NAME = "VenusSupplyStrategyBase";
  IUnitroller public constant UNITROLLER = IUnitroller(0xfD36E2c2a6789Db23113685031d7F16329158384);
  address internal constant XVS_TOKEN = 0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63;

  IVToken public vToken;

  ////////////////////// GAP ///////////////////////////
  //slither-disable-next-line unused-state
  uint256[49] private ______gap;
  //////////////////////////////////////////////////////

  /// ******************************************************
  ///                    Initialization
  /// ******************************************************

  /// @notice Initialize contract after setup it as proxy implementation
  function initializeStrategy(
    address controller_,
    address underlying_,
    address vault_,
    address oToken_,
    uint buybackRatio_
  ) public initializer {
    address[] memory rewardTokens_ = new address[](1);
    rewardTokens_[0] = XVS_TOKEN;

    UniversalLendStrategy.initializeLendStrategy(
      controller_,
      underlying_,
      vault_,
      buybackRatio_,
      rewardTokens_
    );

    vToken = IVToken(oToken_);
    require(vToken.underlying() == _underlying(), "Wrong underlying");
  }

  /// ******************************************************
  ///                    Views
  /// ******************************************************

  /// @notice Strategy balance in the pool
  /// @dev This is amount that we can withdraw
  /// @return Balance amount in underlying tokens
  function _rewardPoolBalance() internal override view returns (uint) {
    IVToken _vToken = vToken;
    return _vToken.balanceOf(address(this)) * _vToken.exchangeRateStored() / 1e18;
  }

  /// @notice Return approximately amount of reward tokens ready to claim
  function readyToClaim() external pure override returns (uint256[] memory) {
    return new uint[](0);
  }

  /// @notice TVL of the underlying in the pool
  function poolTotalAmount() external view override returns (uint256) {
    // exchangeRate = (totalCash + totalBorrows - totalReserves) / totalSupply
    return vToken.totalSupply() * vToken.exchangeRateStored() / 1e18;
  }

  /// ******************************************************
  ///              Internal logic implementation
  /// ******************************************************

  /// @dev Refresh rates and return actual deposited balance in underlying tokens
  function _getActualPoolBalance() internal view override returns (uint) {
    return _rewardPoolBalance();
  }

  /// @dev Deposit to pool and increase local balance
  function _simpleDepositToPool(uint amount) internal override {
    address u = _underlying();
    IVToken _vToken = vToken;
    _approveIfNeeds(u, amount, address(_vToken));
    _vToken.mint(amount);
  }

  /// @dev Perform only withdraw action, without changing local balance
  function _withdrawFromPoolWithoutChangeLocalBalance(uint amount, uint poolBalance) internal override returns (bool withdrewAll, uint withdrawnAmount) {
    address u = _underlying();
    uint underlyingBalanceBefore = IERC20(u).balanceOf(address(this));
    if (amount < poolBalance) {
      vToken.redeemUnderlying(amount);
      withdrewAll = false;
    } else {
      vToken.redeemUnderlying(amount);
      withdrewAll = true;
    }
    uint underlyingBalanceAfter = IERC20(u).balanceOf(address(this));
    withdrawnAmount = underlyingBalanceAfter - underlyingBalanceBefore;
  }

  /// @dev Withdraw all and set localBalance to zero
  function _withdrawAllFromPool() internal override {
    vToken.redeemUnderlying(_rewardPoolBalance());
  }

  /// @dev Claim distribution rewards
  function _claimReward() internal override {
    UNITROLLER.claimVenus(address(this));
  }

  function _preHardWorkHook() internal override {
    vToken.accrueInterest();
  }
}
