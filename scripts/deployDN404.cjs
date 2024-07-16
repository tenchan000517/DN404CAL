const hre = require("hardhat");
const path = require('path');

async function main() {
  const contractName = "MyDN404WithCAL";
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying contract: ${contractName}`);
  console.log(`Running script from: ${path.resolve(__dirname)}`);
  console.log(`Script file: ${path.basename(__filename)}`);
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Contract = await hre.ethers.getContractFactory(contractName);
  const contract = await Contract.deploy();

  await contract.deployed();

  console.log("Contract address:", contract.address);
  console.log("Deployment transaction hash:", contract.deployTransaction.hash);

  // オプショナル：追加のパラメータを設定
  // await contract.setInitialParameters(
  //   "TESTDN404", // NFTの名前
  //   "TEST404",   // NFTのシンボル
  //   1000,        // 新しいトークン供給量
  //   "0x0000000000000000000000000000000000000000000000000000000000000000", // ホワイトリストのルートハッシュ
  //   0, // パブリックプライス
  //   0, // ホワイトリストプライス
  //   "0xdbaa28cBe70aF04EbFB166b1A3E8F8034e5B9FC7" // カスタムCALアドレス（必要な場合）
  // );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });