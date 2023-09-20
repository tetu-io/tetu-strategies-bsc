import {ethers} from "hardhat";
import {DeployerUtilsLocal} from "../../DeployerUtilsLocal";
import {RunHelper} from "../../../utils/tools/RunHelper";
import {BscAddresses} from "../../../addresses/BscAddresses";
import {StrategyVenusSupply__factory} from "../../../../typechain";

async function main() {
  const signer = (await ethers.getSigners())[0];
  const core = await DeployerUtilsLocal.getCoreAddresses();
  const underlying = BscAddresses.USDC_TOKEN;

  const splitterAddress = BscAddresses.xUSDC_SPLITTER
  const logic = await DeployerUtilsLocal.deployContract(signer, "StrategyVenusSupply");
  const stackerProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", logic.address);
  await RunHelper.runAndWait(() => StrategyVenusSupply__factory.connect(stackerProxy.address, signer).initialize(
    core.controller,
    underlying,
    splitterAddress,
    BscAddresses.vUSDC_TOKEN,
    10_00
  ));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
