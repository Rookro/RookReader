import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as CollectionCommands from "./CollectionCommands";

vi.unmock("./CollectionCommands");

describe("CollectionCommands", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  const mockError = { code: 123, message: "Fail" };

  it("getAllCollections should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await CollectionCommands.getAllCollections();
    expect(invoke).toHaveBeenCalledWith("get_all_collections");
  });

  it("getAllCollections should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(CollectionCommands.getAllCollections()).rejects.toThrow(CommandError);
  });

  it("createCollection should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue({ id: 1, name: "Shelf" });
    await CollectionCommands.createCollection("Shelf", "icon");
    expect(invoke).toHaveBeenCalledWith("create_collection", { name: "Shelf", iconId: "icon" });
  });

  it("createCollection should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(CollectionCommands.createCollection("S", "i")).rejects.toThrow(CommandError);
  });

  it("addBookToCollection should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await CollectionCommands.addBookToCollection(1, 2);
    expect(invoke).toHaveBeenCalledWith("add_book_to_collection", { collectionId: 1, bookId: 2 });
  });

  it("addBookToCollection should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(CollectionCommands.addBookToCollection(1, 2)).rejects.toThrow(CommandError);
  });

  it("removeBookFromCollection should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await CollectionCommands.removeBookFromCollection(1, 2);
    expect(invoke).toHaveBeenCalledWith("remove_book_from_collection", {
      collectionId: 1,
      bookId: 2,
    });
  });

  it("removeBookFromCollection should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(CollectionCommands.removeBookFromCollection(1, 2)).rejects.toThrow(CommandError);
  });

  it("getCollectionsForBook should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([2, 3]);
    await expect(CollectionCommands.getCollectionsForBook(1)).resolves.toEqual([2, 3]);
    expect(invoke).toHaveBeenCalledWith("get_collections_for_book", { bookId: 1 });
  });

  it("getCollectionsForBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(CollectionCommands.getCollectionsForBook(1)).rejects.toThrow(CommandError);
  });

  it("setCollectionsForBook should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await CollectionCommands.setCollectionsForBook(1, [2, 3]);
    expect(invoke).toHaveBeenCalledWith("set_collections_for_book", {
      bookId: 1,
      collectionIds: [2, 3],
    });
  });

  it("setCollectionsForBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(CollectionCommands.setCollectionsForBook(1, [2])).rejects.toThrow(CommandError);
  });

  it("deleteCollection should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await CollectionCommands.deleteCollection(1);
    expect(invoke).toHaveBeenCalledWith("delete_collection", { id: 1 });
  });

  it("deleteCollection should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(CollectionCommands.deleteCollection(1)).rejects.toThrow(CommandError);
  });
});
