import {ethers} from "hardhat";
import {DeployerUtilsLocal} from "../DeployerUtilsLocal";
import {BscAddresses} from "../../addresses/BscAddresses";
import {TokenUtils} from "../../../test/TokenUtils";


export async function main() {
  const signer = (await ethers.getSigners())[0];
  const core = await DeployerUtilsLocal.getCoreAddresses();
  const underlying = BscAddresses.DAI_TOKEN;
  const undSymbol = await TokenUtils.tokenSymbol(underlying)

  if (await DeployerUtilsLocal.findVaultUnderlyingInBookkeeper(signer, underlying)) {
    console.error("VAULT WITH THIS UNDERLYING EXIST! skip");
    return;
  }

  await DeployerUtilsLocal.deployVaultWithSplitter(
    undSymbol,
    signer,
    core.controller,
    underlying,
    BscAddresses.ZERO_ADDRESS
  )
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
