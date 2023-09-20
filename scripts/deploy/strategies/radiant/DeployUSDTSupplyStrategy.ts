import {ethers} from "hardhat";
import {DeployerUtilsLocal} from "../../DeployerUtilsLocal";
import {Radiant2SupplyStrategy__factory} from "../../../../typechain";
import {RunHelper} from "../../../utils/tools/RunHelper";
import {BscAddresses} from "../../../addresses/BscAddresses";

async function main() {
  const signer = (await ethers.getSigners())[0];
  const core = await DeployerUtilsLocal.getCoreAddresses();
  const underlying = BscAddresses.USDT_TOKEN;

  const splitterAddress = BscAddresses.xUSDT_SPLITTER;
  const logic = await DeployerUtilsLocal.deployContract(signer, "Radiant2SupplyStrategy");
  const stackerProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", logic.address);
  await RunHelper.runAndWait(() => Radiant2SupplyStrategy__factory.connect(stackerProxy.address, signer).initialize(
    core.controller,
    underlying,
    splitterAddress,
    10_00
  ));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
