"use client";

import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
} from "./actions";

// Define the shape of our data
export type Plan = {
  id: string;
  name: string;
  price: number;
  admissionFee: number;
  durationMonths: number;
  description: string | null;
};

interface PlansClientProps {
  initialData: Plan[];
  gymId: string;
  isProPlan: boolean; // ✅ ADDED: Accept the isProPlan prop
}

export function PlansClient({ initialData, gymId, isProPlan }: PlansClientProps) {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Server Action Handlers ---

  const handleCreate = async (formData: FormData) => {
    setIsSubmitting(true);
    const result = await createMembershipPlan(gymId, formData);
    if (result.success) {
      toast.success(result.message);
      setCreateModalOpen(false);
    } else {
      toast.error(result.message || "An error occurred.");
    }
    setIsSubmitting(false);
  };

  const handleUpdate = async (formData: FormData) => {
    if (!selectedPlan) return;
    setIsSubmitting(true);
    const result = await updateMembershipPlan(selectedPlan.id, gymId, formData);
    if (result.success) {
      toast.success(result.message);
      setEditModalOpen(false);
    } else {
      toast.error(result.message || "An error occurred.");
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!selectedPlan) return;
    setIsSubmitting(true);
    const result = await deleteMembershipPlan(selectedPlan.id, gymId);
    if (result.success) {
      toast.success(result.message);
      setDeleteModalOpen(false);
    } else {
      toast.error(result.message || "An error occurred.");
    }
    setIsSubmitting(false);
  };

  // --- Column Definitions for Tanstack Table ---

  const columns: ColumnDef<Plan>[] = [
    {
      accessorKey: "name",
      header: "Plan Name",
    },
    {
      accessorKey: "price",
      header: "Price (INR)",
      cell: ({ row }) => `₹${(row.original.price / 100).toFixed(2)}`,
    },
    {
      accessorKey: "admissionFee",
      header: "Admission Fee (INR)",
      cell: ({ row }) => `₹${(row.original.admissionFee / 100).toFixed(2)}`,
    },
    {
      accessorKey: "durationMonths",
      header: "Duration",
      cell: ({ row }) => `${row.original.durationMonths} month(s)`,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const plan = row.original;
        // Only show actions for Pro users
        if (!isProPlan) return null;
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedPlan(plan);
                  setEditModalOpen(true);
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  setSelectedPlan(plan);
                  setDeleteModalOpen(true);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: initialData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // --- JSX ---

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setCreateModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Plan
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No membership plans created yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Plan Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Membership Plan</DialogTitle>
          </DialogHeader>
          <form action={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="name">Plan Name</label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <label htmlFor="durationMonths">Duration (months)</label>
              <Input id="durationMonths" name="durationMonths" type="number" required />
            </div>
            <div>
              <label htmlFor="price">Price (INR)</label>
              <Input id="price" name="price" type="number" step="0.01" required />
            </div>
            <div>
              <label htmlFor="admissionFee">Admission Fee (INR)</label>
              <Input id="admissionFee" name="admissionFee" type="number" step="0.01" defaultValue="0" required />
            </div>
            <div>
              <label htmlFor="description">Description</label>
              <Textarea id="description" name="description" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Membership Plan</DialogTitle>
          </DialogHeader>
          <form action={handleUpdate} className="space-y-4">
            <div>
              <label htmlFor="name">Plan Name</label>
              <Input id="name" name="name" defaultValue={selectedPlan?.name} required />
            </div>
            <div>
              <label htmlFor="durationMonths">Duration (months)</label>
              <Input id="durationMonths" name="durationMonths" type="number" defaultValue={selectedPlan?.durationMonths} required />
            </div>
            <div>
              <label htmlFor="price">Price (INR)</label>
              <Input id="price" name="price" type="number" step="0.01" defaultValue={selectedPlan ? selectedPlan.price / 100 : 0} required />
            </div>
            <div>
              <label htmlFor="admissionFee">Admission Fee (INR)</label>
              <Input id="admissionFee" name="admissionFee" type="number" step="0.01" defaultValue={selectedPlan ? selectedPlan.admissionFee / 100 : 0} required />
            </div>
            <div>
              <label htmlFor="description">Description</label>
              <Textarea id="description" name="description" defaultValue={selectedPlan?.description ?? ""} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the "{selectedPlan?.name}" plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
