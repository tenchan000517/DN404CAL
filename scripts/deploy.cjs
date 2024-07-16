const hre = require("hardhat");
const path = require('path'); // 'path' モジュールのインポートを追加

async function main() {
  const contractName = "PAOPAOMulti_2nd"; // コントラクト名
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying contract: ${contractName}`);
  console.log(`Running script from: ${path.resolve(__dirname)}`); // ディレクトリパスの出力
  console.log(`Script file: ${path.basename(__filename)}`); // ファイル名の出力
   console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Contract = await hre.ethers.getContractFactory(contractName);
  const contract = await Contract.deploy();

  // デプロイメントトランザクションの待機
  await contract.deployed();

  console.log("Contract address:", contract.address);
  console.log("Deployment transaction hash:", contract.deployTransaction.hash); // トランザクションハッシュの出力

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
