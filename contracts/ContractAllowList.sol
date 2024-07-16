// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "contract-allow-list/contracts/core/interface/IContractAllowList.sol";

contract ContractAllowList is IContractAllowList, AccessControlEnumerable {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant ALLOW_LIST_EDITOR = keccak256("ALLOW_LIST_EDITOR");

    mapping(uint256 => EnumerableSet.AddressSet) private allowedAddresses;
    uint256 public maxLevel = 0;

    modifier onlyEditor() {
        require(hasRole(ALLOW_LIST_EDITOR, msg.sender), "You are not editor.");
        _;
    }

    modifier levelMustBeSequencial(uint256 _level) {
        require(_level <= maxLevel + 1, "Level must be sequential.");
        _;
    }

    modifier exitsLevel(uint256 _level) {
        require(_level <= maxLevel, "Level does not exist.");
        _;
    }

    constructor(address[] memory _governors) {
        _setRoleAdmin(ALLOW_LIST_EDITOR, ALLOW_LIST_EDITOR);
        for (uint256 i = 0; i < _governors.length; i++) {
            _setupRole(ALLOW_LIST_EDITOR, _governors[i]);
        }
    }

    function addAllowed(address _allowed, uint256 _level)
        external
        override
        onlyEditor
        levelMustBeSequencial(_level)
    {
        allowedAddresses[_level].add(_allowed);
        if (_level == maxLevel + 1) {
            maxLevel++;
        }
        emit ChangeAllowList(_allowed, _level, true);
    }

    function removeAllowed(address _allowed, uint256 _level)
        external
        override
        onlyEditor
        exitsLevel(_level)
    {
        allowedAddresses[_level].remove(_allowed);
        if (_level == maxLevel && EnumerableSet.length(allowedAddresses[_level]) == 0 && maxLevel > 0) {
            maxLevel--;
        }
        emit ChangeAllowList(_allowed, _level, false);
    }

    function getAllowedList(uint256 _level)
        external
        view
        override
        returns (address[] memory)
    {
        return allowedAddresses[_level].values();
    }

    function isAllowed(address _transferer, uint256 _level)
        public
        view
        override
        returns (bool)
    {
        if (_level == 0) {
            return false;
        }

        bool allowed = false;
        for (uint256 i = 1; i < _level + 1; i++) {
            if (allowedAddresses[i].contains(_transferer) == true) {
                allowed = true;
                break;
            }
        }
        return allowed;
    }
}
