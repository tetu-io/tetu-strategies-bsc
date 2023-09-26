import "@tetu_io/tetu-contracts/contracts/openzeppelin/IERC20.sol";

// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IPool {
  function exchangeRate(address token) external returns (uint256 xr);

  function quotePotentialDeposit(
    address token,
    uint256 amount
  ) external view returns (uint256 liquidity, uint256 reward);
}