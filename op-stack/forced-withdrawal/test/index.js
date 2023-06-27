const { expect } = require("chai");
const optimismContracts = require("@eth-optimism/contracts-bedrock"); 
const optimismCoreUtils = require("@eth-optimism/core-utils")
const optimismSDK = require("@eth-optimism/sdk")
const { ethers } = require("hardhat");

const L1_CONTRACTS = {
  StateCommitmentChain: '0x0000000000000000000000000000000000000000',
  CanonicalTransactionChain: '0x0000000000000000000000000000000000000000',
  BondManager: '0x0000000000000000000000000000000000000000',
  AddressManager: '0xdE1FCfB0851916CA5101820A69b13a4E276bd81F',
  L1CrossDomainMessenger: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
  L1StandardBridge: '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1',
  OptimismPortal: '0xbEb5Fc579115071764c7423A4f12eDde41f106Ed',
  L2OutputOracle: '0x0000000000000000000000000000000000000000'
}
const BRIDGES = { 
  Standard: { 
     l1Bridge: L1_CONTRACTS.L1StandardBridge, 
     l2Bridge: "0x4200000000000000000000000000000000000010", 
     Adapter: optimismSDK.StandardBridgeAdapter
  },
  ETH: {
     l1Bridge: L1_CONTRACTS.L1StandardBridge, 
     l2Bridge: "0x4200000000000000000000000000000000000010", 
     Adapter: optimismSDK.ETHBridgeAdapter
  }
}

const sleep = async (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
const Interface = new ethers.utils.Interface(['event RelayedMessage(bytes32 indexed msgHash)','event FailedRelayedMessage(bytes32 indexed msgHash)', "event DepositFinalized(address indexed l1Token,address indexed l2Token,address indexed from,address to,uint256 amount,bytes extraData)",'event ETHBridgeFinalized(address indexed from, address indexed to,uint256 amount,bytes extraData)' ])

describe("Optimism deposit/withdraw", function () {
  let optimismPortal, optimismPortalInterface, account, l2Provider, l1Provider, crossChainMessenger
  before(async ()=>{
    const [signer] = await ethers.getSigners()
    account = signer
    const optimismPortalData = optimismContracts.getContractDefinition("OptimismPortal")
    optimismPortalInterface = new ethers.utils.Interface(optimismPortalData.abi)
    optimismPortal = new ethers.Contract(process.env.OPTIMISM_PORTAL_ADDR, optimismPortalData.abi, account)

    l2Provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545")
    await l2Provider._networkPromise

    crossChainMessenger = new optimismSDK.CrossChainMessenger({
      l1ChainId: ethers.provider.network.chainId,
      l2ChainId: l2Provider.network.chainId,
      l1SignerOrProvider: account,
      l2SignerOrProvider: l2Provider,
      bedrock: true,
      contracts: {
        l1: L1_CONTRACTS
      },
      bridges: BRIDGES
    });
  })
  it("deposit", async function () {
    const transferAmt = ethers.utils.parseEther("1")

    const l1BalanceAfter = await crossChainMessenger.l1Provider.getBalance(account.address)
    const l2BalanceAfter = await crossChainMessenger.l2Provider.getBalance(account.address)
    console.log("before l1",ethers.utils.formatEther(l1BalanceAfter))
    console.log("before l2",ethers.utils.formatEther(l2BalanceAfter))

    const tx1 = await crossChainMessenger.depositETH(transferAmt)
    await tx1.wait()

    const msg = await crossChainMessenger.getMessagesByTransaction(tx1.hash).then(r => r[0])
    console.log(msg)  
    const ADD = "0x36BDE71C97B33Cc4729cf772aE268934f7AB70B2"
    try{
      await l2Provider.send('hardhat_impersonateAccount', [ADD])
    } catch (error) {
      console.log(error)
    }

    const account1 = await l2Provider.getSigner(account.address)
    await account1.sendTransaction({to: ADD , value: ethers.utils.parseEther("20")}).then(r => r.wait())

    const L1CrossDomainMessenger = await l2Provider.getSigner(ADD)
    const L2CrossDomainMessenger_address = "0x4200000000000000000000000000000000000007"
    const L2CrossDomainMessengerContract = optimismContracts.getContractDefinition("L2CrossDomainMessenger")
    const L2CrossDomainMessenger = new ethers.Contract(L2CrossDomainMessenger_address, L2CrossDomainMessengerContract.abi, L1CrossDomainMessenger)
    console.log(msg)
    const res = await L2CrossDomainMessenger.relayMessage(msg.messageNonce, msg.sender, msg.target, msg.value, msg.minGasLimit, msg.message, {gasLimit: 490798, value: msg.value }).then(r=> r.wait())
    const logsParsed = res.logs.map((log) => Interface.parseLog(log))
    console.log(logsParsed)
    
    const l1Balance = await crossChainMessenger.l1Provider.getBalance(account.address)
    const l2Balance = await crossChainMessenger.l2Provider.getBalance(account.address)
    console.log("after l1Balance",ethers.utils.formatEther(l1Balance))
    console.log("after l2Balance",ethers.utils.formatEther(l2Balance))
  })

  it("withdraw", async function () {


  });

  it.skip("optimism L2StandardBridge contract exist", async function () {
    const signer =  await l2Provider.getSigner(account.address)
    const L2StandardBridge_address = "0x4200000000000000000000000000000000000010"
    const L2StandardBridgeContract = optimismContracts.getContractDefinition("L2StandardBridge")
    const L2StandardBridge = new ethers.Contract(L2StandardBridge_address, L2StandardBridgeContract.abi, signer)

    const l1token = await L2StandardBridge.l1TokenBridge()
    expect(l1token).to.be.eq("0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1")

    const messenger =  await L2StandardBridge.MESSENGER()
    expect(messenger).to.be.eq("0x4200000000000000000000000000000000000007")
  })
  it.skip("optimism L2 Cross Domain Messenger contract exist", async function () {
    const signer =  await l2Provider.getSigner(account.address)
    const L2CrossDomainMessenger_address = "0x4200000000000000000000000000000000000007"
    const L2CrossDomainMessengerContract = optimismContracts.getContractDefinition("L2CrossDomainMessenger")
    const L2CrossDomainMessenger = new ethers.Contract(L2CrossDomainMessenger_address, L2CrossDomainMessengerContract.abi, signer)

    const l1CrossDomainMessenger = await L2CrossDomainMessenger.l1CrossDomainMessenger()
    expect(l1CrossDomainMessenger).to.be.eq("0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1")

    const messageNonce = await L2CrossDomainMessenger.messageNonce()
    console.log(messageNonce)
  })
});
