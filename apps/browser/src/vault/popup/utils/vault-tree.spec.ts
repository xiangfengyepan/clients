import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { PopupCipherViewLike } from "../views/popup-cipher.view";

import { buildVaultTree, getNestedFolderTree } from "./vault-tree";

function folder(id: string, name: string): FolderView {
  return Object.assign(new FolderView(), { id, name });
}

function collection(id: string, name: string, organizationId: string): CollectionView {
  return Object.assign(new CollectionView({ id, name, organizationId } as never), {
    id,
    name,
    organizationId,
  });
}

function collectionNode(
  view: CollectionView,
  children: TreeNode<CollectionView>[] = [],
): TreeNode<CollectionView> {
  const node = new TreeNode(view, undefined as never);
  node.children = children;
  return node;
}

function organization(id: string, name: string): Organization {
  return Object.assign(new Organization(), { id, name });
}

function cipher(overrides: Partial<PopupCipherViewLike>): PopupCipherViewLike {
  return {
    id: "cipher",
    name: "Item",
    collectionIds: [],
    ...overrides,
  } as PopupCipherViewLike;
}

const build = (input: Partial<Parameters<typeof buildVaultTree>[0]>) =>
  buildVaultTree({
    ciphers: [],
    folders: [],
    collections: [],
    organizations: [],
    myVaultLabel: "My vault",
    ...input,
  });

describe("getNestedFolderTree", () => {
  it("nests folders by the `/` delimiter", () => {
    const tree = getNestedFolderTree([
      folder("parent-id", "Work"),
      folder("child-id", "Work/Bank"),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].node.id).toBe("parent-id");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].node.id).toBe("child-id");
    expect(tree[0].children[0].node.name).toBe("Bank");
  });
});

describe("buildVaultTree", () => {
  describe("without organizations", () => {
    it("renders the folder tree at the root and keeps unfoldered items outside of it", () => {
      const inFolder = cipher({ id: "a", folderId: "parent-id" });
      const inSubFolder = cipher({ id: "b", folderId: "child-id" });
      const unfoldered = cipher({ id: "c", folderId: null });

      const { nodes, ciphers } = build({
        ciphers: [inFolder, inSubFolder, unfoldered],
        folders: getNestedFolderTree([
          folder("parent-id", "Work"),
          folder("child-id", "Work/Bank"),
        ]),
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe("Work");
      expect(nodes[0].count).toBe(2);
      expect(nodes[0].ciphers).toEqual([inFolder]);
      expect(nodes[0].children[0].name).toBe("Bank");
      expect(nodes[0].children[0].ciphers).toEqual([inSubFolder]);
      expect(ciphers).toEqual([unfoldered]);
    });

    it("omits folders that hold no items", () => {
      const { nodes } = build({
        ciphers: [],
        folders: getNestedFolderTree([folder("empty-id", "Empty")]),
      });

      expect(nodes).toEqual([]);
    });
  });

  describe("with organizations", () => {
    const org = organization("org-id", "Acme");
    const shared = collection("collection-id", "Shared", "org-id");

    it("nests personal items under `My vault` and organization items under their collections", () => {
      const personal = cipher({ id: "a", folderId: null });
      const inCollection = cipher({
        id: "b",
        organizationId: "org-id",
        collectionIds: ["collection-id"],
      });

      const { nodes, ciphers } = build({
        ciphers: [personal, inCollection],
        collections: [collectionNode(shared)],
        organizations: [org],
      });

      expect(ciphers).toEqual([]);
      expect(nodes.map((n) => n.name)).toEqual(["My vault", "Acme"]);
      expect(nodes[0].ciphers).toEqual([personal]);
      expect(nodes[1].children[0].name).toBe("Shared");
      expect(nodes[1].children[0].ciphers).toEqual([inCollection]);
    });

    it("places organization items without a collection directly under the organization", () => {
      const unassigned = cipher({ id: "b", organizationId: "org-id", collectionIds: [] });

      const { nodes } = build({
        ciphers: [unassigned],
        collections: [collectionNode(shared)],
        organizations: [org],
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe("Acme");
      expect(nodes[0].ciphers).toEqual([unassigned]);
      expect(nodes[0].children).toEqual([]);
    });

    it("shows an item that belongs to several collections under each of them", () => {
      const other = collection("other-id", "Other", "org-id");
      const multi = cipher({
        id: "b",
        organizationId: "org-id",
        collectionIds: ["collection-id", "other-id"],
      });

      const { nodes } = build({
        ciphers: [multi],
        collections: [collectionNode(shared), collectionNode(other)],
        organizations: [org],
      });

      expect(nodes[0].children.map((c) => c.name)).toEqual(["Shared", "Other"]);
      expect(nodes[0].count).toBe(2);
    });

    it("omits organizations that hold no items", () => {
      const { nodes } = build({
        ciphers: [cipher({ id: "a", folderId: null })],
        collections: [collectionNode(shared)],
        organizations: [org, organization("empty-org", "Empty")],
      });

      expect(nodes.map((n) => n.name)).toEqual(["My vault"]);
    });
  });
});
