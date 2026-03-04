/**
 * Zod to JSON Schema Converter
 * Zod 스키마를 JSON Schema로 변환
 */
import { ZodType, ZodFirstPartyTypeKind } from "zod";

type JsonSchema = {
  type?: string;
  format?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  nullable?: boolean;
  description?: string;
  example?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodDef = any;

/**
 * Zod 스키마를 JSON Schema로 변환
 */
export function zodToJsonSchema(schema: ZodType): JsonSchema {
  const def: ZodDef = schema._def;

  switch (def.typeName) {
    case ZodFirstPartyTypeKind.ZodString: {
      const result: JsonSchema = { type: "string" };

      for (const check of def.checks || []) {
        if (check.kind === "min") result.minLength = check.value;
        if (check.kind === "max") result.maxLength = check.value;
        if (check.kind === "email") result.format = "email";
        if (check.kind === "url") result.format = "uri";
        if (check.kind === "uuid") result.format = "uuid";
        if (check.kind === "regex") result.pattern = check.regex.source;
      }

      return result;
    }

    case ZodFirstPartyTypeKind.ZodNumber: {
      const result: JsonSchema = { type: "number" };

      for (const check of def.checks || []) {
        if (check.kind === "min") result.minimum = check.value;
        if (check.kind === "max") result.maximum = check.value;
        if (check.kind === "int") result.type = "integer";
      }

      return result;
    }

    case ZodFirstPartyTypeKind.ZodBoolean:
      return { type: "boolean" };

    case ZodFirstPartyTypeKind.ZodDate:
      return { type: "string", format: "date-time" };

    case ZodFirstPartyTypeKind.ZodEnum:
      return { type: "string", enum: def.values };

    case ZodFirstPartyTypeKind.ZodArray:
      return {
        type: "array",
        items: zodToJsonSchema(def.type),
      };

    case ZodFirstPartyTypeKind.ZodObject: {
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(def.shape())) {
        properties[key] = zodToJsonSchema(value as ZodType);

        // Check if the field is required (not optional and not nullable with default)
        const innerDef: ZodDef = (value as ZodType)._def;
        if (
          innerDef.typeName !== ZodFirstPartyTypeKind.ZodOptional &&
          innerDef.typeName !== ZodFirstPartyTypeKind.ZodDefault
        ) {
          required.push(key);
        }
      }

      return {
        type: "object",
        properties,
        ...(required.length > 0 && { required }),
      };
    }

    case ZodFirstPartyTypeKind.ZodOptional:
      return zodToJsonSchema(def.innerType);

    case ZodFirstPartyTypeKind.ZodNullable: {
      const inner = zodToJsonSchema(def.innerType);
      return { ...inner, nullable: true };
    }

    case ZodFirstPartyTypeKind.ZodDefault: {
      const inner = zodToJsonSchema(def.innerType);
      return { ...inner, default: def.defaultValue() };
    }

    case ZodFirstPartyTypeKind.ZodEffects:
      return zodToJsonSchema(def.schema);

    case ZodFirstPartyTypeKind.ZodLiteral:
      return { type: typeof def.value, enum: [def.value] };

    case ZodFirstPartyTypeKind.ZodUnion: {
      // 간단한 경우만 처리 (nullable union 등)
      const options = def.options;
      if (options.length === 2) {
        const nullIndex = options.findIndex(
          (opt: ZodType) => (opt._def as ZodDef).typeName === ZodFirstPartyTypeKind.ZodNull
        );
        if (nullIndex !== -1) {
          const otherIndex = nullIndex === 0 ? 1 : 0;
          const inner = zodToJsonSchema(options[otherIndex] as ZodType);
          return { ...inner, nullable: true };
        }
      }
      return {};
    }

    default:
      return {};
  }
}
