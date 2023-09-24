// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IPoolDepositor {
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );

  function approveSpendingByPool(address[] memory tokens, address pool)
  external;

  function approveSpendingByPoolAndBooster(
    address[] memory tokens,
    address pool
  ) external;

  function approveSpendingMultiplePools(uint256[] memory pids) external;

  function booster() external view returns (address);

  function deposit(
    address _lptoken,
    uint256 _amount,
    uint256 _minLiquidity,
    uint256 _deadline,
    bool _stake
  ) external;

  function depositNative(
    address _lptoken,
    uint256 _minLiquidity,
    uint256 _deadline,
    bool _stake
  ) external payable;

  function getDepositAmountOut(address _lptoken, uint256 _amount)
  external
  view
  returns (uint256 liquidity, uint256 reward);

  function getTokenDecimals(address _token)
  external
  view
  returns (uint8 decimals);

  function getWithdrawAmountOut(
    address _lptoken,
    address _tokenOut,
    uint256 _amount
  ) external view returns (uint256 amount, uint256 fee);

  function lpTokenToPid(address) external view returns (uint256);

  function masterWombat() external view returns (address);

  function owner() external view returns (address);

  function renounceOwnership() external;

  function resqueNative(address _recipient) external;

  function resqueTokens(address[] memory _tokens, address _recipient)
  external;

  function setBoosterLpTokensPid() external;

  function transferOwnership(address newOwner) external;

  function updateBooster() external;

  function voterProxy() external view returns (address);

  function weth() external view returns (address);

  function withdraw(
    address _lptoken,
    uint256 _amount,
    uint256 _minOut,
    uint256 _deadline,
    address _recipient
  ) external;

  function withdrawFromOtherAsset(
    address _lptoken,
    address _underlying,
    uint256 _amount,
    uint256 _minOut,
    uint256 _deadline,
    address _recipient
  ) external;

  function withdrawNative(
    address _lptoken,
    address _underlying,
    uint256 _amount,
    uint256 _minOut,
    uint256 _deadline,
    address _recipient
  ) external;
}