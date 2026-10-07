import { EditBase, Form } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import { CompanyInputs } from "./CompanyInputs";
import { normalizeCompanyLinks } from "./companyLinks";
import { CompanyAside } from "./CompanyAside";
import { FormToolbar } from "../layout/FormToolbar";

export const CompanyEdit = () => (
  <EditBase actions={false} redirect="show" transform={normalizeCompanyLinks}>
    <div className="mt-2 flex gap-8 pb-20 sm:pb-0">
      <Form className="flex flex-1 flex-col gap-4 pb-2">
        <Card>
          <CardContent>
            <CompanyInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>

      <CompanyAside link="show" />
    </div>
  </EditBase>
);
