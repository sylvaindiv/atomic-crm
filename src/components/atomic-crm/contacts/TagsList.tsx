import { useRecordContext } from "ra-core";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useContactResource } from "./contactResource";

const ColoredBadge = (props: any) => {
  const record = useRecordContext();
  if (!record) return null;
  return (
    <Badge
      {...props}
      style={{ backgroundColor: record.color, border: 0 }}
      variant="outline"
      className={cn("text-black font-normal", props.className)}
    >
      {record.name}
    </Badge>
  );
};

export const TagsList = () => {
  const resource = useContactResource();
  return (
    <ReferenceArrayField
      className="inline-block"
      resource={resource}
      source="tags"
      reference="tags"
    >
      <SingleFieldList>
        <ColoredBadge source="name" />
      </SingleFieldList>
    </ReferenceArrayField>
  );
};
