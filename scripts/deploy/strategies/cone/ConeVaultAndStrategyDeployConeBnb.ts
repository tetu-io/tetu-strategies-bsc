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

const UNDERLYING = BscAddresses.CONE_CONE_BNB_PAIR;
const GAUGE = BscAddresses.CONE_CONE_BNB_GAUGE;

async function main() {
  const signer = (await ethers.getSigners())[0];
  const core = await DeployerUtilsLocal.getCoreAddresses();
  const undSymbol = await TokenUtils.tokenSymbol(UNDERLYING)

  const vaultProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", DeployerUtilsLocal.getVaultLogic(signer).address);
  await RunHelper.runAndWait(() => ISmartVault__factory.connect(vaultProxy.address, signer).initializeSmartVault(
    "Tetu Vault " + undSymbol,
    "x" + undSymbol,
    core.controller,
    UNDERLYING,
    60 * 60 * 24 * 7,
    false,
    BscAddresses.ZERO_ADDRESS,
    0
  ));
  const strategyProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", ConeConstants.CONE_STRATEGY_LOGIC);
  await RunHelper.runAndWait(() => StrategyCone__factory.connect(strategyProxy.address, signer).initialize(
    core.controller,
    UNDERLYING,
    vaultProxy.address,
    GAUGE,
    ConeConstants.CONE_STACKER
  ));

  const txt = `vault: ${vaultProxy.address}\nstrategy: ${strategyProxy.address}`;
  writeFileSync(`tmp/deployed/cone_${undSymbol.replace('/', '-')}.txt`, txt, 'utf8');

  const governance = await IController__factory.connect(core.controller, signer).governance();
  if (governance.toLowerCase() === signer.address.toLowerCase()) {
    await RunHelper.runAndWait(() => IController__factory.connect(core.controller, signer).addVaultsAndStrategies(
      [vaultProxy.address],
      [strategyProxy.address],
    ));
    await RunHelper.runAndWait(() => ConeStacker__factory.connect(ConeConstants.CONE_STACKER, signer).changeDepositorStatus(strategyProxy.address, true));
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
