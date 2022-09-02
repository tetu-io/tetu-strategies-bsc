import {deployConeVaultAndStrategy} from "../DeployConeVaultAndStrategy";
import {readFileSync} from "fs";

async function main() {

  const pairsData = JSON.parse(readFileSync('scripts/deploy/strategies/cone/vaults/cone_pairs.json', 'utf8'));

  for (const pair of pairsData.data.pairs) {
    console.log(pair.symbol, parseFloat(pair.reserveUSD));
    await deployConeVaultAndStrategy(pair.id, pair.gauge.id);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });


/*

{
  pairs(first: 100, orderBy: reserveUSD, orderDirection: desc) {
  id
  symbol
  reserveUSD
  gauge {
    id
  }
}
}
*/
