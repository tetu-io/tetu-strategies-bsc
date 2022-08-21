import {ethers} from "hardhat";
import {DeployerUtilsLocal} from "../../DeployerUtilsLocal";
import {ConeStacker__factory} from "../../../../typechain";
import {RunHelper} from "../../../utils/tools/RunHelper";

async function main() {
  const signer = (await ethers.getSigners())[0];
  const core = await DeployerUtilsLocal.getCoreAddresses();

  const logic = await DeployerUtilsLocal.deployContract(signer, "ConeStacker");
  const stackerProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", logic.address);
  await RunHelper.runAndWait(() => ConeStacker__factory.connect(stackerProxy.address, signer).initialize(
    core.controller
  ));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
