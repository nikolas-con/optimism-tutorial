const { expect } = require("chai");
const optimismContracts = require("@eth-optimism/contracts-bedrock"); 
const optimismCoreUtils = require("@eth-optimism/core-utils")
const optimismSDK = require("@eth-optimism/sdk")
const { ethers, network } = require("hardhat");

const L1_CONTRACTS = {
  StateCommitmentChain: '0xbe5dab4a2e9cd0f27300db4ab94bee3a233aeb19',
  CanonicalTransactionChain: '0x0000000000000000000000000000000000000000',
  BondManager: '0x0000000000000000000000000000000000000000',
  AddressManager: '0xdE1FCfB0851916CA5101820A69b13a4E276bd81F',
  L1CrossDomainMessenger: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
  L1StandardBridge: '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1',
  OptimismPortal: '0xbEb5Fc579115071764c7423A4f12eDde41f106Ed',
  L2OutputOracle: '0xdfe97868233d1aa22e815a266982f2cf17685a27'
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
const Interface = new ethers.utils.Interface([
  'event RelayedMessage(bytes32 indexed msgHash)',
  'event FailedRelayedMessage(bytes32 indexed msgHash)', 
  'event DepositFinalized(address indexed l1Token,address indexed l2Token,address indexed from,address to,uint256 amount,bytes extraData)',
  'event ETHBridgeFinalized(address indexed from, address indexed to,uint256 amount,bytes extraData)',
  'event WithdrawalInitiated(address indexed l1Token,address indexed l2Token,address indexed from,address to,uint256 amount,bytes extraData)',
  'event ETHBridgeInitiated(address indexed from,address indexed to,uint256 amount,bytes extraData)',
  'event MessagePassed(uint256 indexed nonce, address indexed sender,address indexed target,uint256 value,uint256 gasLimit,bytes data,bytes32 withdrawalHash)',
  'event SentMessage(address indexed target,address sender,bytes message,uint256 messageNonce,uint256 gasLimit)',
  'event SentMessageExtension1(address indexed sender, uint256 value)',
  'event ETHWithdrawalFinalized(address indexed from,address indexed to,uint256 amount,bytes extraData)',
  'event ETHBridgeFinalized(address indexed from,address indexed to,uint256 amount,bytes extraData)',
  'event WithdrawalFinalized(bytes32 indexed withdrawalHash, bool success)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event ERC20BridgeFinalized(address indexed localToken,address indexed remoteToken,address indexed from,address to,uint256 amount,bytes extraData)',
  'event Mint(address indexed account, uint256 amount)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
 ])

 const SCC_INTERFACE = new ethers.utils.Interface([
  'function FRAUD_PROOF_WINDOW() view returns (uint256)',
])

 const ERC20_INTERFACE = new ethers.utils.Interface([
  'function balanceOf(address account) view returns (uint256)',
])

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
    const l1Signer = account
    const l2Signer = await l2Provider.getSigner(account.address)
    crossChainMessenger = new optimismSDK.CrossChainMessenger({
      l1ChainId: ethers.provider.network.chainId,
      l2ChainId: l2Provider.network.chainId,
      l1SignerOrProvider: l1Signer,
      l2SignerOrProvider: l2Signer,
      bedrock: true,
      contracts: {
        l1: L1_CONTRACTS
      },
      bridges: BRIDGES
    });
    crossChainMessenger.getMessageStatus()
  })
  it.skip("deposit", async function () {
    const transferAmt = ethers.utils.parseEther("1")

  
    const tx1 = await crossChainMessenger.depositETH(transferAmt)
    await tx1.wait()

    const msg = await crossChainMessenger.getMessagesByTransaction(tx1.hash).then(r => r[0])

    const ADD = "0x36BDE71C97B33Cc4729cf772aE268934f7AB70B2"
    try{
      await l2Provider.send('anvil_impersonateAccount', [ADD])
    } catch (error) {
      console.log(error)
    }

    const account1 = await l2Provider.getSigner(account.address)
    await account1.sendTransaction({to: ADD , value: ethers.utils.parseEther("20")}).then(r => r.wait())

    const l2BalanceBefore = await crossChainMessenger.l2Provider.getBalance(account.address)


    const L1CrossDomainMessenger = await l2Provider.getSigner(ADD)
    const L2CrossDomainMessenger_address = "0x4200000000000000000000000000000000000007"
    const L2CrossDomainMessengerContract = optimismContracts.getContractDefinition("L2CrossDomainMessenger")
    const L2CrossDomainMessenger = new ethers.Contract(L2CrossDomainMessenger_address, L2CrossDomainMessengerContract.abi, L1CrossDomainMessenger)

    const res = await L2CrossDomainMessenger.relayMessage(msg.messageNonce, msg.sender, msg.target, msg.value, msg.minGasLimit, msg.message, {gasLimit: 490798, value: msg.value }).then(r=> r.wait())
    const logsParsed = res.logs.map((log) => Interface.parseLog(log))
    
    const l2Balance = await crossChainMessenger.l2Provider.getBalance(account.address)
    expect(l2BalanceBefore.add(transferAmt)).to.be.eq(l2Balance)
  })

  it("withdraw", async function () {
    // const withdrawAmount = ethers.utils.parseEther("0.5")
    // const tx = await crossChainMessenger.withdrawETH(withdrawAmount)
    // const tx_resit = await tx.wait()
    // const logsParsed = tx_resit.logs.map((log) => Interface.parseLog(log))
    // expect(logsParsed.length).eq(5)

    // console.log(await ethers.provider.getTransactionReceipt("0x1dd030c744019171bf4d72f31b5420f60cf0abfdd36eef0afd4de082debc3bae"))
    const tx_hash = "0x11abf844724a91ace89d6bd22416cb855919f418a8300a6c11344e639a7815b5"
    const tx_receipt = await l2Provider.getTransactionReceipt(tx_hash)
    const logsParsed = Interface.parseLog(tx_receipt.logs[2])
    
    await crossChainMessenger.proveMessage(tx_hash)

    const ERC20 = new ethers.Contract(logsParsed.args[0], ERC20_INTERFACE, account)
    const beforeBalance = await ERC20.balanceOf(tx_receipt.from)
    
    const scc = new ethers.Contract(L1_CONTRACTS.StateCommitmentChain, SCC_INTERFACE, account)
    const fraudProofWindow =  await scc.FRAUD_PROOF_WINDOW()
    await network.provider.request({method: "evm_increaseTime", params: [fraudProofWindow.toNumber() * 2]})
    await network.provider.request({method: "evm_mine", params: []})
    
    const tx = await crossChainMessenger.finalizeMessage(tx_hash)
    const re = await tx.wait()
    // const logsParsed = re.logs.map((log) => Interface.parseLog(log))
    console.log(Interface.parseLog(re.logs[0]))
    // console.log(Interface.parseLog(re.logs[1]))
    console.log(Interface.parseLog(re.logs[2]))
    console.log(Interface.parseLog(re.logs[3]))
    console.log(Interface.parseLog(re.logs[4]))
    
    await crossChainMessenger.getMessagesByTransaction(tx_hash)
    
    const afterBalance =  await ERC20.balanceOf(tx_receipt.from)
    console.log(ethers.utils.formatEther(beforeBalance), ethers.utils.formatEther(afterBalance))
    return
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
