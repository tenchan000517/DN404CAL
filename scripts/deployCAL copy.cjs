const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("Account balance:", balance.toString());

  const MyDN404WithCAL = await ethers.getContractFactory("MyDN404WithCAL");
  
  // コンストラクタの引数を準備
  // const name = "MyToken";
  // const symbol = "MTK";
  // const allowlistRoot = ethers.utils.hexZeroPad("0x00", 32); // 例: 空のMerkleRoot
  // const publicPrice = ethers.utils.parseEther("0"); // 0.1 ETH
  // const allowlistPrice = ethers.utils.parseEther("0"); // 0.08 ETH
  // const initialTokenSupply = ethers.utils.parseEther("1000"); // 1000トークン
  // const initialSupplyOwner = deployer.address;
  // const calAddress = "0xdbaa28cBe70aF04EbFB166b1A3E8F8034e5B9FC7"; // CALコントラクトのアドレス

  const contract = await MyDN404WithCAL.deploy(
    // name,
    // symbol,
    // allowlistRoot,
    // publicPrice,
    // allowlistPrice,
    // initialTokenSupply,
    // initialSupplyOwner,
    // calAddress
  );

  await contract.deployed();

  console.log("MyDN404WithCAL deployed to:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });