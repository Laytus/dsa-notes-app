interface NamedRecord {
  readonly id: bigint;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NamedResource {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function serializeNamedResource(record: NamedRecord): NamedResource {
  return {
    id: record.id.toString(),
    name: record.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
