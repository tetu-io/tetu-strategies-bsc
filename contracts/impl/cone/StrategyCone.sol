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

import "../../strategies/cone/ConeStrategyBase.sol";

contract StrategyCone is ConeStrategyBase {
  using SafeERC20 for IERC20;

  address[] private _assets;

  function initialize(
    address controller_,
    address underlying_,
    address vault_,
    address gauge_,
    address coneStacker
  ) external initializer {
    require(ISmartVault(vault_).underlying() == underlying_, "!underlying");
    initializeStrategy(controller_, vault_, gauge_, coneStacker);

    (address t0, address t1) = IPair(underlying_).tokens();
    _assets.push(t0);
    _assets.push(t1);
  }

  function assets() external view override returns (address[] memory) {
    return _assets;
  }

}
