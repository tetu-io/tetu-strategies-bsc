import {BscAddresses} from "../../../../addresses/BscAddresses";
import {deployConeVaultAndStrategy} from "../DeployConeVaultAndStrategy";

const UNDERLYING = BscAddresses.CONE_V_CONE_BNB_PAIR;
const GAUGE = BscAddresses.CONE_V_CONE_BNB_GAUGE;

async function main() {
  await deployConeVaultAndStrategy(UNDERLYING, GAUGE)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
