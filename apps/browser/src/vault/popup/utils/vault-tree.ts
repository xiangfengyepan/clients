import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ITreeNodeObject, TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { BitwardenIcon } from "@bitwarden/components";

import { PopupCipherViewLike } from "../views/popup-cipher.view";

/** A single, collapsible group of items in the vault tree. */
export interface VaultTreeNode {
  /** Stable identifier used to track the node's expanded state. */
  id: string;
  name: string;
  icon: BitwardenIcon;
  /** Nested folders/collections. */
  children: VaultTreeNode[];
  /** Items that live directly in this node, i.e. not in any of its children. */
  ciphers: PopupCipherViewLike[];
  /** Number of items in this node and all of its descendants. */
  count: number;
}

export interface VaultTree {
  /** Top level folder, collection and organization groups. */
  nodes: VaultTreeNode[];
  /** Items rendered at the root, outside of any group. */
  ciphers: PopupCipherViewLike[];
}

export interface VaultTreeInput {
  /** The already filtered/searched ciphers to place in the tree. */
  ciphers: PopupCipherViewLike[];
  /** Nested folder structure, as produced by `ServiceUtils.nestedTraverse`. */
  folders: TreeNode<FolderView>[];
  /** Nested collection structure for all organizations, as produced by `CollectionService.getAllNested`. */
  collections: TreeNode<CollectionView>[];
  organizations: Organization[];
  /** Translated label for the personal vault root node. */
  myVaultLabel: string;
}

const NESTING_DELIMITER = "/";

const FOLDER_ICON: BitwardenIcon = "bwi-folder";
const COLLECTION_ICON: BitwardenIcon = "bwi-collection-shared";
const MY_VAULT_ICON: BitwardenIcon = "bwi-user";
const ORGANIZATION_ICON: BitwardenIcon = "bwi-business";

/**
 * Builds the vault tree: personal items nested under their folders, organization items nested
 * under their collections with one root node per organization.
 *
 * Items that belong to more than one collection appear under each of them, matching how the
 * collection filter behaves. Nodes that end up with no items are omitted, since the incoming
 * ciphers are already filtered.
 */
export function buildVaultTree({
  ciphers,
  folders,
  collections,
  organizations,
  myVaultLabel,
}: VaultTreeInput): VaultTree {
  const personalCiphers = ciphers.filter((c) => !c.organizationId);
  const orgCiphers = ciphers.filter((c) => c.organizationId);

  const byFolder = groupBy(personalCiphers, (c) => c.folderId ?? null);
  const folderNodes = buildNodes(folders, "folder", FOLDER_ICON, (id) => byFolder.get(id) ?? []);
  const itemsWithNoFolder = byFolder.get(null) ?? [];

  const organizationNodes = organizations
    .map((org) => buildOrganizationNode(org, orgCiphers, collections))
    .filter((node): node is VaultTreeNode => node !== null);

  // Without organizations there is nothing to distinguish the personal vault from, so the folder
  // tree is rendered at the root instead of being nested under a redundant "My vault" node. This
  // keys off membership rather than the built nodes so the shape of the tree stays stable as
  // filters change.
  if (organizations.length === 0) {
    return { nodes: folderNodes, ciphers: itemsWithNoFolder };
  }

  const myVaultCount = itemsWithNoFolder.length + sumCounts(folderNodes);

  const nodes =
    myVaultCount === 0
      ? organizationNodes
      : [
          {
            id: "my-vault",
            name: myVaultLabel,
            icon: MY_VAULT_ICON,
            children: folderNodes,
            ciphers: itemsWithNoFolder,
            count: myVaultCount,
          },
          ...organizationNodes,
        ];

  return { nodes, ciphers: [] };
}

function buildOrganizationNode(
  organization: Organization,
  orgCiphers: PopupCipherViewLike[],
  collections: TreeNode<CollectionView>[],
): VaultTreeNode | null {
  const ciphers = orgCiphers.filter((c) => c.organizationId === organization.id);

  if (ciphers.length === 0) {
    return null;
  }

  const byCollection = new Map<string, PopupCipherViewLike[]>();
  const unassigned: PopupCipherViewLike[] = [];

  ciphers.forEach((cipher) => {
    const collectionIds = cipher.collectionIds ?? [];

    if (collectionIds.length === 0) {
      unassigned.push(cipher);
      return;
    }

    collectionIds.forEach((collectionId) => {
      // `collectionIds` is branded as `CollectionId` on the SDK backed view, but node ids are
      // plain strings.
      const key = String(collectionId);
      const existing = byCollection.get(key);
      if (existing) {
        existing.push(cipher);
      } else {
        byCollection.set(key, [cipher]);
      }
    });
  });

  const children = buildNodes(
    collections.filter((c) => c.node.organizationId === organization.id),
    "collection",
    COLLECTION_ICON,
    (id) => byCollection.get(id) ?? [],
  );

  return {
    id: `organization:${organization.id}`,
    name: organization.name,
    icon: ORGANIZATION_ICON,
    children,
    ciphers: unassigned,
    count: unassigned.length + sumCounts(children),
  };
}

/** Converts a `TreeNode` branch into `VaultTreeNode`s, dropping branches that hold no items. */
function buildNodes<T extends ITreeNodeObject>(
  nodes: TreeNode<T>[],
  idPrefix: string,
  icon: BitwardenIcon,
  ciphersFor: (id: string) => PopupCipherViewLike[],
): VaultTreeNode[] {
  return nodes
    .map((node) => {
      const children = buildNodes(node.children ?? [], idPrefix, icon, ciphersFor);
      const ciphers = node.node.id ? ciphersFor(node.node.id) : [];

      return {
        id: `${idPrefix}:${node.node.id ?? node.node.name ?? ""}`,
        name: node.node.name ?? "",
        icon,
        children,
        ciphers,
        count: ciphers.length + sumCounts(children),
      };
    })
    .filter((node) => node.count > 0);
}

function sumCounts(nodes: VaultTreeNode[]): number {
  return nodes.reduce((total, node) => total + node.count, 0);
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();

  items.forEach((item) => {
    const key = keyOf(item);
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  });

  return groups;
}

/**
 * Returns a nested folder structure based on the input `FolderView` array. Folder nesting is
 * expressed through the `/` delimiter in the folder name.
 */
export function getNestedFolderTree(folders: FolderView[]): TreeNode<FolderView>[] {
  const nodes: TreeNode<FolderView>[] = [];

  folders.forEach((f) => {
    const folderCopy = new FolderView();
    folderCopy.id = f.id;
    folderCopy.revisionDate = f.revisionDate;

    // Remove "/" from beginning and end of the folder name
    // then split the folder name by the delimiter
    const parts = f.name != null ? f.name.replace(/^\/+|\/+$/g, "").split(NESTING_DELIMITER) : [];
    ServiceUtils.nestedTraverse(nodes, 0, parts, folderCopy, undefined, NESTING_DELIMITER);
  });

  return nodes;
}
