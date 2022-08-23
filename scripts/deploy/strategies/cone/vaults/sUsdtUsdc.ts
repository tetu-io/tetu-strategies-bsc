import {BscAddresses} from "../../../../addresses/BscAddresses";
import {deployConeVaultAndStrategy} from "../DeployConeVaultAndStrategy";
import {IMultiRewardsPool__factory} from "../../../../../typechain";
import {ethers} from "hardhat";

const GAUGE = BscAddresses.CONE_S_USDT_USDC_GAUGE;

async function main() {
  const pool = await IMultiRewardsPool__factory.connect(GAUGE, ethers.provider).underlying();
  await deployConeVaultAndStrategy(pool, GAUGE);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
