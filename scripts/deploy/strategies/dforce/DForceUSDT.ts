import {ethers} from "hardhat";
import {DeployerUtilsLocal} from "../../DeployerUtilsLocal";
import {IERC20Extended__factory} from "../../../../typechain";
import {writeFileSync} from "fs";
import {BscAddresses} from "../../../addresses/BscAddresses";

const strategyContractName = 'StrategyDForceFold';
const VAULT = '0x676418e9a927c58291808ff87fdFb5Dd04975aB2';
const UNDERLYING = BscAddresses.USDT_TOKEN;
const I_TOKEN = "0xb3ab7148cCCAf66686AD6C1bE24D83e58E6a504e";
const BORROW_FACTOR = 8000;
const COLLATERAL_FACTOR = 8499;

async function main() {
  const signer = (await ethers.getSigners())[0];
  const core = await DeployerUtilsLocal.getCoreAddresses();

  const args = [
    core.controller,
    VAULT,
    UNDERLYING,
    I_TOKEN,
    BORROW_FACTOR,
    COLLATERAL_FACTOR,
  ];

  const data = await DeployerUtilsLocal.deployContract(signer, strategyContractName, ...args);

  const symb = await IERC20Extended__factory.connect(UNDERLYING, signer).symbol()

  const txt = `strategy: ${data.address}`;
  writeFileSync(`./tmp/deployed/${strategyContractName}_${symb}.txt`, txt, 'utf8');

  await DeployerUtilsLocal.wait(5);
  await DeployerUtilsLocal.verifyWithArgs(data.address, args);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
