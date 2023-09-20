// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./IVBep20.sol";

interface IUnitroller {
    function claimVenus(address) external;
}