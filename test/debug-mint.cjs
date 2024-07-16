const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("MyDN404WithCAL", function() {
    let MyDN404WithCAL, contract, DN404Mirror, mirror, owner, addr1, addr2, addr3, addr4, addr5, addr6;
    let calMock;
    const NAME = "TestToken";
    const SYMBOL = "TT";
    const PUBLIC_PRICE = ethers.utils.parseEther("0.1");
    const ALLOWLIST_PRICE = ethers.utils.parseEther("0.05");
    const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
    const MINT_RATIO = 10;
    const DECIMALS = 18;
    const UNIT = ethers.BigNumber.from(MINT_RATIO).mul(ethers.BigNumber.from(10).pow(DECIMALS));

    before(async function() {
        [owner, addr1, addr2, addr3, addr4, addr5, addr6] = await ethers.getSigners();

        // CALMockをデプロイ
        const CALMock = await ethers.getContractFactory("CALMock");
        calMock = await CALMock.deploy();
        await calMock.deployed();

        MyDN404WithCAL = await ethers.getContractFactory("MyDN404WithCAL");
        DN404Mirror = await ethers.getContractFactory("DN404Mirror");
    });

    beforeEach(async function() {
        const merkleTree = new MerkleTree([addr1.address, addr2.address].map(keccak256), keccak256, { sortPairs: true });
        const rootHash = merkleTree.getRoot();

        contract = await MyDN404WithCAL.deploy(
            NAME,
            SYMBOL,
            rootHash,
            PUBLIC_PRICE,
            ALLOWLIST_PRICE,
            INITIAL_SUPPLY,
            owner.address,
            calMock.address
        );
        await contract.deployed();
        await contract.toggleLive();

        const mirrorAddress = await contract.dn404MirrorAddress();
        mirror = await DN404Mirror.attach(mirrorAddress);
    });

    async function getBalances(address) {
        const tokenBalance = await contract.balanceOf(address);
        const nftBalance = await mirror.balanceOf(address);
        return { tokenBalance, nftBalance };
    }

    it("Should set the correct initial state", async function() {
        expect(await contract.name()).to.equal(NAME);
        expect(await contract.symbol()).to.equal(SYMBOL);
        expect(await contract.publicPrice()).to.equal(PUBLIC_PRICE);
        expect(await contract.allowlistPrice()).to.equal(ALLOWLIST_PRICE);
        expect(await contract.totalSupply()).to.equal(INITIAL_SUPPLY);
        expect(await contract.CAL()).to.equal(calMock.address);
    });

    it("Should mint tokens and NFTs correctly", async function() {
        const mintAmount = UNIT.mul(2);
        await contract.connect(addr1).mint(mintAmount, { value: PUBLIC_PRICE.mul(2) });
        
        const { tokenBalance, nftBalance } = await getBalances(addr1.address);
        expect(tokenBalance).to.equal(mintAmount);
        expect(nftBalance).to.equal(2);
    });

    it("Should mint NFTs correctly using mintNFT function", async function() {
        const nftAmount = 2;
        await contract.connect(addr2).mintNFT(nftAmount, { value: PUBLIC_PRICE.mul(nftAmount) });
        
        const { tokenBalance, nftBalance } = await getBalances(addr2.address);
        expect(tokenBalance).to.equal(UNIT.mul(nftAmount));
        expect(nftBalance).to.equal(nftAmount);
    });

    it("Should allow allowlist minting with valid proof", async function() {
        const merkleTree = new MerkleTree([addr1.address, addr2.address].map(keccak256), keccak256, { sortPairs: true });
        const proof = merkleTree.getHexProof(keccak256(addr1.address));
        
        await contract.connect(addr1).allowlistMint(UNIT, proof, { value: ALLOWLIST_PRICE });
        
        const { tokenBalance, nftBalance } = await getBalances(addr1.address);
        expect(tokenBalance).to.equal(UNIT);
        expect(nftBalance).to.equal(1);
    });

    it("Should handle NFT burning and minting during transfers", async function() {
        await contract.connect(addr1).mint(UNIT.mul(3), { value: PUBLIC_PRICE.mul(3) });
        await contract.connect(addr1).transfer(addr2.address, UNIT.mul(2));
        
        const { nftBalance: nftBalance1 } = await getBalances(addr1.address);
        const { nftBalance: nftBalance2 } = await getBalances(addr2.address);
        
        expect(nftBalance1).to.equal(1);
        expect(nftBalance2).to.equal(2);
    });

    it("Should respect CAL restrictions for setApprovalForAll", async function() {
        await contract.setEnableRestrict(true);
        await calMock.setIsAllowed(addr2.address, false);
        
        await expect(contract.connect(addr1).setApprovalForAll(addr2.address, true))
            .to.be.revertedWith("CALCheckFailed");
        
        await calMock.setIsAllowed(addr2.address, true);
        await expect(contract.connect(addr1).setApprovalForAll(addr2.address, true))
            .not.to.be.reverted;
    });

    it("Should allow owner to update CAL settings", async function() {
        const newCALMock = await (await ethers.getContractFactory("CALMock")).deploy();
        await contract.connect(owner).setCAL(newCALMock.address);
        expect(await contract.CAL()).to.equal(newCALMock.address);

        await contract.connect(owner).setCALLevel(2);
        expect(await contract.CALLevel()).to.equal(2);

        await contract.connect(owner).setEnableRestrict(false);
        expect(await contract.enableRestrict()).to.be.false;
    });

    it("Should handle edge cases in token transfers", async function() {
        await contract.connect(addr1).mint(UNIT, { value: PUBLIC_PRICE });
        await contract.connect(addr1).transfer(addr2.address, UNIT.div(10));
        
        const { tokenBalance: balance1, nftBalance: nftBalance1 } = await getBalances(addr1.address);
        const { tokenBalance: balance2, nftBalance: nftBalance2 } = await getBalances(addr2.address);
        
        expect(balance1).to.equal(UNIT.mul(9).div(10));
        expect(nftBalance1).to.equal(0);
        expect(balance2).to.equal(UNIT.div(10));
        expect(nftBalance2).to.equal(0);
    });

    it("Should mint tokens and NFTs correctly with different amounts", async function() {
        const amounts = [1, 2, 4, 5, 6, 10].map(a => UNIT.mul(a));
        const minters = [addr1, addr2, addr3, addr4, addr5, addr6];
    
        for (let i = 0; i < minters.length; i++) {
            const amount = amounts[i];
            const minter = minters[i];
            
            await contract.connect(minter).mint(amount, { value: PUBLIC_PRICE.mul(amount.div(UNIT)) });
    
            const { tokenBalance, nftBalance } = await getBalances(minter.address);
    
            expect(nftBalance).to.equal(amount.div(UNIT));
            expect(tokenBalance).to.equal(amount);
        }
    });

    it("Should allow owner to set withdraw address and withdraw", async function() {
        const newWithdrawAddress = addr5.address;
        await contract.connect(owner).setWithdrawAddress(newWithdrawAddress);
        expect(await contract.withdrawAddress()).to.equal(newWithdrawAddress);

        await contract.connect(addr1).mint(UNIT, { value: PUBLIC_PRICE });
        const initialBalance = await ethers.provider.getBalance(newWithdrawAddress);
        await contract.connect(owner).withdraw();
        const finalBalance = await ethers.provider.getBalance(newWithdrawAddress);
        expect(finalBalance.sub(initialBalance)).to.equal(PUBLIC_PRICE);
    });

    it("Should allow owner to set max per wallet and max supply", async function() {
        const newMaxPerWallet = 500;
        const newMaxSupply = 2000;
        await contract.connect(owner).setMaxPerWallet(newMaxPerWallet);
        await contract.connect(owner).setMaxSupply(newMaxSupply);
        expect(await contract.maxPerWallet()).to.equal(newMaxPerWallet);
        expect(await contract.maxSupply()).to.equal(newMaxSupply);
    });

    it("Should set base URI correctly", async function() {
        const newBaseURI = "https://example.com/";
        await contract.connect(owner).setBaseURI(newBaseURI);
        await contract.connect(addr1).mint(UNIT, { value: PUBLIC_PRICE });
        const tokenId = 0;
        expect(await mirror.tokenURI(tokenId)).to.equal(newBaseURI + tokenId + ".json");
    });

    it("Should return correct debug information", async function() {
        const [isRestricted, isLocallyAllowed, calLevel] = await contract.isAllowedDebug(addr1.address);
        expect(isRestricted).to.be.true;
        expect(isLocallyAllowed).to.be.false;
        expect(calLevel).to.equal(1);
    });

    it("Should toggle live status correctly", async function() {
        const initialLiveStatus = await contract.live();
        await contract.connect(owner).toggleLive();
        const newLiveStatus = await contract.live();
        expect(newLiveStatus).to.equal(!initialLiveStatus);
    });

    it("Should not allow minting when not live", async function() {
        await contract.connect(owner).toggleLive();
        await expect(contract.connect(addr1).mint(UNIT, { value: PUBLIC_PRICE }))
            .to.be.revertedWith("NotLive");
    });

    it("Should not allow minting above max supply", async function() {
        await contract.connect(owner).setMaxSupply(1);
        await contract.connect(addr1).mint(UNIT, { value: PUBLIC_PRICE });
        await expect(contract.connect(addr2).mint(UNIT, { value: PUBLIC_PRICE }))
            .to.be.revertedWith("TotalSupplyReached");
    });

    it("Should not allow minting above max per wallet", async function() {
        await contract.connect(owner).setMaxPerWallet(1);
        await contract.connect(addr1).mint(UNIT, { value: PUBLIC_PRICE });
        await expect(contract.connect(addr1).mint(UNIT, { value: PUBLIC_PRICE }))
            .to.be.revertedWith("InvalidMint");
    });

    it("Should allow owner to add and remove local contract allow list", async function() {
        await contract.connect(owner).addLocalContractAllowList(addr3.address);
        expect((await contract.isAllowedDebug(addr3.address))[1]).to.be.true;

        await contract.connect(owner).removeLocalContractAllowList(addr3.address);
        expect((await contract.isAllowedDebug(addr3.address))[1]).to.be.false;
    });

    it("Should emit correct events", async function() {
        await expect(contract.connect(owner).setCAL(addr4.address))
            .to.emit(contract, "CALSet")
            .withArgs(addr4.address);

        await expect(contract.connect(owner).setCALLevel(2))
            .to.emit(contract, "CALLevelUpdated")
            .withArgs(2);

        await expect(contract.connect(owner).setEnableRestrict(false))
            .to.emit(contract, "RestrictStatusUpdated")
            .withArgs(false);

        await expect(contract.connect(owner).addLocalContractAllowList(addr5.address))
            .to.emit(contract, "LocalAllowListAdded")
            .withArgs(owner.address, addr5.address);

        await expect(contract.connect(owner).removeLocalContractAllowList(addr5.address))
            .to.emit(contract, "LocalAllowListRemoved")
            .withArgs(owner.address, addr5.address);

        await expect(contract.connect(owner).setWithdrawAddress(addr6.address))
            .to.emit(contract, "WithdrawAddressSet")
            .withArgs(addr6.address);
    });
});