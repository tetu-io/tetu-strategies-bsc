import {ethers} from "hardhat";
import {DeployerUtilsLocal} from "../../DeployerUtilsLocal";
import {ConeStacker__factory, StrategyVenusSupply__factory} from "../../../../typechain";
import {RunHelper} from "../../../utils/tools/RunHelper";
import {BscAddresses} from "../../../addresses/BscAddresses";

async function main() {
  const signer = (await ethers.getSigners())[0];
  const core = await DeployerUtilsLocal.getCoreAddresses();
  const underlying = BscAddresses.BTCB;

  const splitterAddress = "" // <----
  const logic = await DeployerUtilsLocal.deployContract(signer, "StrategyVenusSupply");
  const stackerProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", logic.address);
  await RunHelper.runAndWait(() => StrategyVenusSupply__factory.connect(stackerProxy.address, signer).initialize(
    core.controller,
    underlying,
    splitterAddress,
    BscAddresses.vBTC_TOKEN,
    "500"
  ));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
