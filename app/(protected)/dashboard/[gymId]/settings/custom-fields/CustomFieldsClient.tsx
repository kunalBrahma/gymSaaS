"use client";

import { useState } from "react";
import { useTransition } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, Edit, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createCustomField, updateCustomField, deleteCustomField } from "./actions";

// A client-safe type definition for the custom field data
type ClientCustomField = {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options: string | null; // Expect options as a stringified JSON array
  order: number;
};

interface CustomFieldsClientProps {
  initialFields: ClientCustomField[];
  gymId: string;
}

export function CustomFieldsClient({ initialFields, gymId }: CustomFieldsClientProps) {
  const [isModalOpen, setModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<ClientCustomField | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fieldType, setFieldType] = useState("text");
  // ✅ ADDED: State to explicitly control the checkbox
  const [isRequired, setIsRequired] = useState(false);

  const handleFormSubmit = (formData: FormData) => {
    // ✅ FIXED: Explicitly set the 'required' value from our controlled state
    formData.set('required', String(isRequired));

    // Convert the options textarea (one option per line) into a JSON string array
    if (formData.get('type') === 'select') {
      const optionsText = formData.get('options') as string;
      const optionsArray = optionsText.split('\n').map(opt => opt.trim()).filter(Boolean);
      formData.set('options', JSON.stringify(optionsArray));
    }

    startTransition(async () => {
      const action = selectedField 
        ? updateCustomField.bind(null, selectedField.id, gymId)
        : createCustomField.bind(null, gymId);
      
      const result = await action(formData);
      if (result.success) {
        toast.success(result.message);
        setModalOpen(false);
        setSelectedField(null);
      } else {
        toast.error(result.message || "An error occurred.");
      }
    });
  };

  const handleDelete = () => {
    if (!selectedField) return;
    startTransition(async () => {
      const result = await deleteCustomField(selectedField.id, gymId);
      if (result.success) {
        toast.success(result.message);
        setDeleteModalOpen(false);
        setSelectedField(null);
      } else {
        toast.error(result.message || "An error occurred.");
      }
    });
  };

  const openModal = (field: ClientCustomField | null = null) => {
    setSelectedField(field);
    setFieldType(field?.type || "text");
    // ✅ ADDED: Set the initial state for the checkbox when the modal opens
    setIsRequired(field?.required || false);
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => openModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Custom Field
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {initialFields.length > 0 ? (
            initialFields.map(field => (
              <div key={field.id} className="flex items-center justify-between p-3 rounded-md border bg-card">
                <div>
                  <p className="font-medium">{field.name} {field.required && <span className="text-red-500">*</span>}</p>
                  <p className="text-sm text-muted-foreground">Type: {field.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => openModal(field)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="destructive" size="icon" onClick={() => { setSelectedField(field); setDeleteModalOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">No custom fields created yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Field Modal */}
      <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedField ? "Edit Custom Field" : "Create Custom Field"}</DialogTitle>
          </DialogHeader>
          <form action={handleFormSubmit} className="space-y-4">
            <div>
              <label htmlFor="name">Field Name / Label</label>
              <Input id="name" name="name" defaultValue={selectedField?.name} required />
            </div>
            <div>
              <label htmlFor="type">Field Type</label>
              <Select name="type" defaultValue={fieldType} onValueChange={setFieldType} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Dropdown (Select)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fieldType === 'select' && (
              <div>
                <label htmlFor="options">Dropdown Options</label>
                <Textarea 
                  id="options" 
                  name="options" 
                  placeholder="Enter one option per line" 
                  defaultValue={selectedField?.options ? JSON.parse(selectedField.options).join('\n') : ''} 
                />
              </div>
            )}
            <div className="flex items-center space-x-2">
              {/* ✅ FIXED: Converted to a controlled component */}
              <Checkbox 
                id="required" 
                name="required" 
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(Boolean(checked))}
              />
              <label htmlFor="required">This field is required</label>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save Field"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Are you sure?</DialogTitle></DialogHeader>
          <DialogDescription>
            This will permanently delete the "{selectedField?.name}" field. This action cannot be undone.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>{isPending ? "Deleting..." : "Confirm Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
