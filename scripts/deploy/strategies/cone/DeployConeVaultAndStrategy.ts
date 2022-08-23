import {ethers} from "hardhat";
import {DeployerUtilsLocal} from "../../DeployerUtilsLocal";
import {
  ConeStacker__factory, IController__factory,
  ISmartVault__factory,
  StrategyCone__factory
} from "../../../../typechain";
import {writeFileSync} from "fs";
import {BscAddresses} from "../../../addresses/BscAddresses";
import {ConeConstants} from "./ConeConstants";
import {RunHelper} from "../../../utils/tools/RunHelper";
import {TokenUtils} from "../../../../test/TokenUtils";
import {TimeUtils} from "../../../../test/TimeUtils";
import {Misc} from "../../../utils/tools/Misc";

// tslint:disable-next-line:no-var-requires
const hre = require("hardhat");

export async function deployConeVaultAndStrategy(underlying: string, gauge: string) {
  const signer = (await ethers.getSigners())[0];
  const core = await DeployerUtilsLocal.getCoreAddresses();
  const undSymbol = await TokenUtils.tokenSymbol(underlying)

  if (await DeployerUtilsLocal.findVaultUnderlyingInBookkeeper(signer, underlying)) {
    console.error("VAULT WITH THIS UNDERLYING EXIST! skip");
    return;
  }

  const vaultProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", DeployerUtilsLocal.getVaultLogic(signer).address);
  await RunHelper.runAndWait(() => ISmartVault__factory.connect(vaultProxy.address, signer).initializeSmartVault(
    "Tetu Vault " + undSymbol,
    "x" + undSymbol,
    core.controller,
    underlying,
    60 * 60 * 24 * 7,
    false,
    BscAddresses.ZERO_ADDRESS,
    0
  ));
  const strategyProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", ConeConstants.CONE_STRATEGY_LOGIC);
  await RunHelper.runAndWait(() => StrategyCone__factory.connect(strategyProxy.address, signer).initialize(
    core.controller,
    underlying,
    vaultProxy.address,
    gauge,
    ConeConstants.CONE_STACKER
  ));

  if (hre.network.name !== 'hardhat') {
    const txt = `vault: ${vaultProxy.address}\nstrategy: ${strategyProxy.address}`;
    writeFileSync(`tmp/deployed/cone_${undSymbol.replace('/', '-')}.txt`, txt, 'utf8');
  }

  const governance = await IController__factory.connect(core.controller, signer).governance();
  if (governance.toLowerCase() === signer.address.toLowerCase()) {
    await DeployerUtilsLocal.wait(10);
    await RunHelper.runAndWait(() => IController__factory.connect(core.controller, signer).addVaultsAndStrategies(
      [vaultProxy.address],
      [strategyProxy.address],
    ));
    await DeployerUtilsLocal.wait(10);
    await RunHelper.runAndWait(() => ConeStacker__factory.connect(ConeConstants.CONE_STACKER, signer).changeDepositorStatus(strategyProxy.address, true));
  }
}
