import {BscAddresses} from "../../../addresses/BscAddresses";

interface IMBInfo {
  underlyingName: string,
  underlying: string,
  stablecoin: string,
  targetPercentage: string,
  collateralNumerator?: string, // will be used '1' on deploy, when undefined
}

const infos: IMBInfo[] = [
    // for now CelsiusX only tokens.
    // same strategy can be used for all other MAI vaults
  {
    underlyingName: 'cxDOGE',
    underlying: BscAddresses.cxDOGE_TOKEN,
    stablecoin: BscAddresses.cxDOGE_MAI_VAULT,
    targetPercentage: '300',
  },
  {
    underlyingName: 'cxADA',
    underlying: BscAddresses.cxADA_TOKEN,
    stablecoin: BscAddresses.cxADA_MAI_VAULT,
    targetPercentage: '300',
  },
  {
    underlyingName: 'cxETH',
    underlying: BscAddresses.cxETH_TOKEN,
    stablecoin: BscAddresses.cxETH_MAI_VAULT,
    targetPercentage: '300',
  },
]

export {IMBInfo, infos}
