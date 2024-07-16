// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./DN404.sol";
import "./DN404Mirror.sol";
import {Ownable} from "solady/src/auth/Ownable.sol";
import {LibString} from "solady/src/utils/LibString.sol";
import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";
import {MerkleProofLib} from "solady/src/utils/MerkleProofLib.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IContractAllowListProxy {
    function isAllowed(address _transferer, uint256 _level) external view returns (bool);
}

interface IContractAllowList {
    function getAllowedList(uint256 level) external view returns (address[] memory);
}

contract MyDN404WithCAL is DN404, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    // Token metadata
    string private constant _NAME = "My DN404 Token";
    string private constant _SYMBOL = "MDN";
    string private _baseURI = "https://nft-mint.xyz/data/tenplatemetadata/";

    // Minting controls
    uint256 public publicPrice = 0; // Initially free
    uint256 public allowlistPrice = 0; // Initially free

    bool public live = false;
    bytes32 private _allowlistRoot = 0x0000000000000000000000000000000000000000000000000000000000000000;

    // Supply and minting limits
    uint256 public constant MAX_SUPPLY = 10000; // 10000 MTK
    uint256 public tokensPerNFT = 10; // 10 MTK per NFT, initially
    uint256 public totalMinted;
    uint256 public MAX_PER_WALLET = 1000; // 1000 NFT per wallet

    uint256 private _basicUnit = 10**18; // 基本単位を10 * 10**18に設定

    // CAL related
    IContractAllowListProxy public CAL;
    IContractAllowList public CALCore;
    uint256 public CALLevel = 1;
    bool public enableRestrict = true;
    EnumerableSet.AddressSet private _localAllowList;

    // Other
    address public withdrawAddress = 0xDC68E2aF8816B3154c95dab301f7838c7D83A0Ba;
    address public dn404MirrorAddress;

    // Events
    event PriceUpdated(uint256 newPrice);
    event TokensPerNFTUpdated(uint256 newTokensPerNFT);
    event MaxNFTPerWalletUpdated(uint256 newMaxNFTPerWallet);
    // event CALSet(address indexed calAddress);
    event CALLevelUpdated(uint256 newLevel);
    event RestrictStatusUpdated(bool status);
    event LocalAllowListAdded(address indexed operator, address indexed allowed);
    event LocalAllowListRemoved(address indexed operator, address indexed allowed);
    event CALRestrictionTriggered(address indexed operator, string operation);
    event WithdrawAddressSet(address indexed newWithdrawAddress);
    event WithdrawalMade(address indexed to, uint256 amount);
    event CALSet(address indexed calProxyAddress, address indexed calCoreAddress);

    // Errors
    error NotLive();
    error InvalidPrice();
    error TotalSupplyReached();
    error WalletLimitExceeded();
    error InvalidProof();
    error WithdrawFailed();
    error CALCheckFailed(address operator, string operation);
    error InvalidMint();

    constructor(
    ) {
        _initializeOwner(msg.sender);

        withdrawAddress = msg.sender;

        address mirror = address(new DN404Mirror(msg.sender));
        _initializeDN404(0, msg.sender, mirror);
        dn404MirrorAddress = mirror;

        // _setCAL(0xdbaa28cBe70aF04EbFB166b1A3E8F8034e5B9FC7); // Ethereum mainnet proxy
        // _setCAL(0xb506d7BbE23576b8AAf22477cd9A7FDF08002211); // Goerli testnet proxy
        _setCAL(0x49FF5bA3c2eA8175EB72eBd109945705bB1334AC, 0xe7B85FC636416ca76399F13e72A916325D37DfF7);

        _addLocalContractAllowList(0x1E0049783F008A0085193E00003D00cd54003c71); // OpenSea
        _addLocalContractAllowList(0x4feE7B061C97C9c496b01DbcE9CDb10c02f0a0Be); // Rarible
        _addLocalContractAllowList(0x9A1D00bEd7CD04BCDA516d721A596eb22Aac6834); // MgicEdden
        _addLocalContractAllowList(mirror);
    }

    modifier onlyLive() {
        if (!live) {
            revert NotLive();
        }
        _;
    }

    // Minting functions
    modifier checkPrice(uint256 price, uint256 nftAmount) {
        if (price * nftAmount != msg.value) {
            revert InvalidPrice();
        }
        _;
    }

    modifier checkAndUpdateTotalMinted(uint256 nftAmount) {
        uint256 newTotalMinted = uint256(totalMinted) + nftAmount;
        if (newTotalMinted > MAX_SUPPLY) {
            revert TotalSupplyReached();
        }
        totalMinted = uint32(newTotalMinted);
        _;
    }

    modifier checkAndUpdateBuyerMintCount(uint256 nftAmount) {
        uint256 currentMintCount = _getAux(msg.sender);
        uint256 newMintCount = currentMintCount + nftAmount;
        if (newMintCount > MAX_PER_WALLET) {
            revert InvalidMint();
        }
        _setAux(msg.sender, uint88(newMintCount));
        _;
    }

    function mint(uint256 nftAmount)
        public
        payable
        onlyLive
        checkPrice(publicPrice, nftAmount)
        checkAndUpdateBuyerMintCount(nftAmount)
        checkAndUpdateTotalMinted(nftAmount)
    {
        _mint(msg.sender, nftAmount * _basicUnit);
    }

    function allowlistMint(uint256 nftAmount, bytes32[] calldata proof)
        public
        payable
        onlyLive
        checkPrice(allowlistPrice, nftAmount)
        checkAndUpdateBuyerMintCount(nftAmount)
        checkAndUpdateTotalMinted(nftAmount)
    {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!MerkleProofLib.verifyCalldata(proof, _allowlistRoot, leaf)) {
            revert InvalidProof();
        }
        _mint(msg.sender, nftAmount * _basicUnit);
    }

    function mintNFT(uint256 nftAmount)
        public
        payable
        onlyLive
        checkPrice(publicPrice, nftAmount)
        checkAndUpdateBuyerMintCount(nftAmount)
        checkAndUpdateTotalMinted(nftAmount)
    {
        _mint(msg.sender, nftAmount * _unit());
    }

    function allowlistMintNFT(uint256 nftAmount, bytes32[] calldata proof)
        public
        payable
        onlyLive
        checkPrice(allowlistPrice, nftAmount)
        checkAndUpdateBuyerMintCount(nftAmount)
        checkAndUpdateTotalMinted(nftAmount)
    {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!MerkleProofLib.verifyCalldata(proof, _allowlistRoot, leaf)) {
            revert InvalidProof();
        }
        _mint(msg.sender, nftAmount * _unit());
    }

    // DN404 override
    function _unit() internal view override returns (uint256) {
        return tokensPerNFT * _basicUnit;
    }

    // 基本単位を設定する関数
    function setBasicUnit(uint256 newBasicUnit) external {
        _basicUnit = newBasicUnit;
    }

    // 基本単位を取得する関数
    function getBasicUnit() public view returns (uint256) {
        return _basicUnit;
    }

    function setMaxPerWallet(uint256 _maxPerWallet) public onlyOwner {
        MAX_PER_WALLET = _maxPerWallet;
        emit MaxNFTPerWalletUpdated(_maxPerWallet);
    }

    // maxNFTPerWalletを読み取る関数
    function getMaxPerWallet() public view returns (uint256) {
        return MAX_PER_WALLET;
    }

    // CAL related functions
    function _setCAL(address _cal, address _calCore) internal {
        CAL = IContractAllowListProxy(_cal);
        CALCore = IContractAllowList(_calCore);
        emit CALSet(_cal, _calCore);
    }

    function setCAL(address _cal, address _calCore) external onlyOwner {
        _setCAL(_cal, _calCore);
    }

    function setCALLevel(uint256 _level) external onlyOwner {
        CALLevel = _level;
        emit CALLevelUpdated(_level);
    }

    function setEnableRestrict(bool _status) external onlyOwner {
        enableRestrict = _status;
        emit RestrictStatusUpdated(_status);
    }

    function _addLocalContractAllowList(address allowed) internal {
        _localAllowList.add(allowed);
        emit LocalAllowListAdded(msg.sender, allowed);
    }

    function addLocalContractAllowList(address allowed) external onlyOwner {
        _addLocalContractAllowList(allowed);
    }

    function removeLocalContractAllowList(address allowed) external onlyOwner {
        _localAllowList.remove(allowed);
        emit LocalAllowListRemoved(msg.sender, allowed);
    }

    function getLocalContractAllowList() external view returns (address[] memory) {
        return _localAllowList.values();
    }

    function _isAllowed(address operator) internal view returns (bool) {
        if (!enableRestrict) return true;
        if (_localAllowList.contains(operator)) return true;
        return CAL.isAllowed(operator, CALLevel);
    }

    function _transfer(address from, address to, uint256 amount) internal virtual override {
        if (!_isAllowed(msg.sender)) {
            revert CALCheckFailed(msg.sender, "transfer");
        }
        super._transfer(from, to, amount);
    }

    // Admin functions
    function setTokensPerNFT(uint256 newTokensPerNFT) external onlyOwner {
        require(newTokensPerNFT > 0, "Tokens per NFT must be greater than 0");
        tokensPerNFT = newTokensPerNFT;
        emit TokensPerNFTUpdated(newTokensPerNFT);
    }

    function setPublicPrice(uint256 newpublicPrice) external onlyOwner {
        publicPrice = newpublicPrice;
        emit PriceUpdated(newpublicPrice);
    }

    function setAllowlistPrice(uint256 newallowlistPrice) external onlyOwner {
        allowlistPrice = newallowlistPrice;
        emit PriceUpdated(newallowlistPrice);
    }

    function toggleLive() public onlyOwner {
        live = !live;
    }

    function setBaseURI(string calldata baseURI_) public onlyOwner {
        _baseURI = baseURI_;
    }

    function setWithdrawAddress(address _withdrawAddress) public onlyOwner {
        withdrawAddress = _withdrawAddress;
        emit WithdrawAddressSet(_withdrawAddress);
    }

    function withdraw() public payable onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = payable(withdrawAddress).call{value: amount}("");
        if (!success) revert WithdrawFailed();
        emit WithdrawalMade(withdrawAddress, amount);
    }

    // View functions
    function name() public pure override returns (string memory) {
        return _NAME;
    }

    function symbol() public pure override returns (string memory) {
        return _SYMBOL;
    }

    function _tokenURI(uint256 tokenId) internal view override returns (string memory result) {
        if (bytes(_baseURI).length != 0) {
            result = string(abi.encodePacked(_baseURI, LibString.toString(tokenId), ".json"));
        }
    }
}