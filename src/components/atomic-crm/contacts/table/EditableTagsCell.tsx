import { TagsListEdit } from "../TagsListEdit";

/**
 * Table-cell wrapper around the existing `TagsListEdit`.
 *
 * Reuses it verbatim — only isolates clicks so adding/removing a tag
 * doesn't bubble up and trigger the row's navigate handler.
 */
export const EditableTagsCell = () => (
  <div onClick={(event) => event.stopPropagation()}>
    <TagsListEdit />
  </div>
);
