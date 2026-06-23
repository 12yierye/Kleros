interface StorageManager {
  getDirectory(): Promise<FileSystemDirectoryHandle>
}
