import {CoreAddresses} from "./scripts/models/CoreAddresses";
import {ToolsAddresses} from "./scripts/models/ToolsAddresses";
import {BscCoreAddresses} from "./addresses_core_bsc";
import {BscToolsAddresses} from "./addresses_tools_bsc";

export class Addresses {

  public static CORE = new Map<string, CoreAddresses>([
    ['56', BscCoreAddresses.ADDRESSES],
  ]);

  public static TOOLS = new Map<string, ToolsAddresses>([
    ['56', BscToolsAddresses.ADDRESSES],
  ]);
}
