import {
  ExternalArgs,
  DataViewAndAllocatorCarrier,
  StringEntry,
  NumberEntry,
  MapEntry,
  SetEntry
} from "./interfaces";
import {
  readEntry,
  writeValueInPtrToPtrAndHandleMemory,
  handleArcForDeletedValuePointer,
  decrementRefCount,
  writeEntry
} from "./store";
import { entryToFinalJavaScriptValue } from "./entryToFinalJavaScriptValue";
import {
  hashMapDelete,
  hashMapLowLevelIterator,
  hashMapNodePointerToKeyValue,
  hashMapInsertUpdate,
  hashMapValueLookup,
  createHashMap
} from "./hashmap/hashmap";
import { getObjectOrMapOrSetAddresses } from "./getAllLinkedAddresses";

export function deleteObjectPropertyEntryByKey(
  externalArgs: ExternalArgs,
  carrier: DataViewAndAllocatorCarrier,
  hashmapPointer: number,
  keyToDeleteBy: string | number
): boolean {
  const deletedValuePointerToPointer = hashMapDelete(
    externalArgs,
    carrier,
    hashmapPointer,
    keyToDeleteBy
  );

  // no such key
  if (deletedValuePointerToPointer === 0) {
    return false;
  }

  const deletedValuePointer = carrier.dataView.getUint32(
    deletedValuePointerToPointer
  );

  handleArcForDeletedValuePointer(externalArgs, carrier, deletedValuePointer);

  return true;
}

export function getObjectPropertiesEntries(
  externalArgs: ExternalArgs,
  dataView: DataView,
  hashmapPointer: number
): Array<{ key: string | number; valuePointer: number }> {
  let iterator = 0;
  const foundValues: Array<{ key: string | number; valuePointer: number }> = [];

  while (
    (iterator = hashMapLowLevelIterator(dataView, hashmapPointer, iterator))
  ) {
    const { valuePointer, keyPointer } = hashMapNodePointerToKeyValue(
      dataView,
      iterator
    );

    const keyEntry = readEntry(externalArgs, dataView, keyPointer) as
      | StringEntry
      | NumberEntry;

    foundValues.push({
      valuePointer: dataView.getUint32(valuePointer),
      key: keyEntry.value
    });
  }

  return foundValues;
}

export function objectSet(
  externalArgs: ExternalArgs,
  carrier: DataViewAndAllocatorCarrier,
  hashMapPointer: number,
  p: string | number,
  value: any
) {
  const ptrToPtr = hashMapInsertUpdate(
    externalArgs,
    carrier,
    hashMapPointer,
    p
  );

  writeValueInPtrToPtrAndHandleMemory(externalArgs, carrier, ptrToPtr, value);
}

export function objectGet(
  externalArgs: ExternalArgs,
  carrier: DataViewAndAllocatorCarrier,
  entryPointer: number,
  key: string | number
) {
  const valuePointer = hashMapValueLookup(
    externalArgs,
    carrier.dataView,
    entryPointer,
    key
  );

  if (valuePointer === 0) {
    return undefined;
  }

  return entryToFinalJavaScriptValue(
    externalArgs,
    carrier,
    carrier.dataView.getUint32(valuePointer)
  );
}

export function hashmapClearFree(
  externalArgs: ExternalArgs,
  carrier: DataViewAndAllocatorCarrier,
  hashmapPointer: number
) {
  const leafAddresses: number[] = [];
  const arcAddresses: number[] = [];

  getObjectOrMapOrSetAddresses(
    externalArgs,
    carrier.dataView,
    false,
    hashmapPointer,
    leafAddresses,
    arcAddresses
  );

  for (const address of leafAddresses) {
    carrier.allocator.free(address);
  }

  for (const address of arcAddresses) {
    decrementRefCount(externalArgs, carrier.dataView, address);
  }
}

export function mapOrSetClear(
  externalArgs: ExternalArgs,
  carrier: DataViewAndAllocatorCarrier,
  mapOrSetPtr: number
) {
  const entry = readEntry(externalArgs, carrier.dataView, mapOrSetPtr) as
    | MapEntry
    | SetEntry;

  hashmapClearFree(externalArgs, carrier, entry.value);

  entry.value = createHashMap(carrier, externalArgs.hashMapMinInitialCapacity);

  writeEntry(externalArgs, carrier.dataView, mapOrSetPtr, entry);
}
