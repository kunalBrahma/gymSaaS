"use client";

import { useState, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import { MoreHorizontal, PlusCircle, Eye, RefreshCw, ClipboardCopy } from "lucide-react";
import { toast } from "react-hot-toast";
import { format, isBefore, addDays } from "date-fns";
import Link from "next/link";
import Image from "next/image";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createMember, updateMember, deleteMember, renewMembership } from "./actions";
import type { Member, MembershipPlan } from "@prisma/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type MemberWithPlan = Member & { plan: MembershipPlan };

interface MembersClientProps {
  initialMembers: MemberWithPlan[];
  membershipPlans: MembershipPlan[];
  gymId: string;
  isProPlan: boolean;
}

export function MembersClient({ initialMembers, membershipPlans, gymId, isProPlan }: MembersClientProps) {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isRenewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [shareablePlanId, setShareablePlanId] = useState<string | undefined>(membershipPlans[0]?.id);

  const data = useMemo(() => {
    if (expiryFilter === "expiring") {
      const oneWeekFromNow = addDays(new Date(), 7);
      return initialMembers.filter(member => 
        member.membershipExpiresAt && isBefore(new Date(member.membershipExpiresAt), oneWeekFromNow)
      );
    }
    return initialMembers;
  }, [initialMembers, expiryFilter]);

  const handleFormAction = async (action: (formData: FormData) => Promise<any>, formData: FormData) => {
    setIsSubmitting(true);
    const result = await action(formData);
    if (result.success) {
      toast.success(result.message);
      setAddModalOpen(false);
      setEditModalOpen(false);
    } else {
      toast.error(result.message || "An error occurred.");
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!selectedMember) return;
    setIsSubmitting(true);
    const result = await deleteMember(selectedMember.id, gymId);
    if (result.success) {
      toast.success(result.message);
      setDeleteModalOpen(false);
    } else {
      toast.error(result.message || "An error occurred.");
    }
    setIsSubmitting(false);
  };

  const handleRenew = async (formData: FormData) => {
    if (!selectedMember) return;
    const newPlanId = formData.get("planId") as string;
    setIsSubmitting(true);
    const result = await renewMembership(selectedMember.id, gymId, newPlanId);
    if (result.success) {
      toast.success(result.message);
      setRenewModalOpen(false);
    } else {
      toast.error(result.message || "An error occurred.");
    }
    setIsSubmitting(false);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareLink = shareablePlanId ? `${origin}/join/${gymId}?plan=${shareablePlanId}` : "";
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Signup link copied!");
  };

  const columns: ColumnDef<MemberWithPlan>[] = [
    { 
      accessorKey: "name", 
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.photoUrl ? (
            <Image src={row.original.photoUrl} alt={row.original.name} width={40} height={40} className="rounded-full h-10 w-10 object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-medium">
              {row.original.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
          )}
          <span className="font-medium">{row.original.name}</span>
        </div>
      )
    },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "plan.name", header: "Plan" },
    {
      accessorKey: "membershipExpiresAt",
      header: "Expires On",
      cell: ({ row }) => row.original.membershipExpiresAt ? format(new Date(row.original.membershipExpiresAt), "PPP") : "N/A",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href={`/dashboard/${gymId}/members/${row.original.id}`}><Eye className="mr-2 h-4 w-4" /> View Details</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedMember(row.original); setRenewModalOpen(true); }}><RefreshCw className="mr-2 h-4 w-4" /> Renew</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedMember(row.original); setEditModalOpen(true); }}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-500" onClick={() => { setSelectedMember(row.original); setDeleteModalOpen(true); }}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4">
        <Input placeholder="Search members..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-sm" />
        <div className="flex items-center gap-2">
           <Select value={expiryFilter} onValueChange={setExpiryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="expiring">Expiring in 7 Days</SelectItem>
              </SelectContent>
            </Select>
          <Button onClick={() => setAddModalOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Member</Button>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>{table.getHeaderGroups().map(hg => <TableRow key={hg.id}>{hg.headers.map(h => <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map(row => (
              <TableRow key={row.id}>{row.getVisibleCells().map(cell => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>
            )) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No members found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
      </div>

      {/* Add Member Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Add New Member</DialogTitle></DialogHeader>
          <Tabs defaultValue="manual">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              <TabsTrigger value="share" disabled={!isProPlan}>Share Link (Pro)</TabsTrigger>
            </TabsList>
            <TabsContent value="manual">
              <form action={(fd) => handleFormAction(createMember.bind(null, gymId), fd)} className="grid grid-cols-2 gap-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
                <div className="col-span-2 font-semibold">Personal Details</div>
                <div><label>Full Name</label><Input name="name" required /></div>
                <div><label>Email</label><Input name="email" type="email" required /></div>
                <div><label>Phone</label><Input name="phone" /></div>
                <div><label>Gender</label><Select name="gender"><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
                <div><label>Date of Birth</label><Input name="dateOfBirth" type="date" /></div>
                <div><label>Joining Date</label><Input name="joinedAt" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required /></div>
                {/* ✅ FIXED: Added missing weight and height fields */}
                <div><label>Weight (kg)</label><Input name="weightKg" type="number" step="0.1" /></div>
                <div><label>Height (cm)</label><Input name="heightCm" type="number" step="0.1" /></div>
                <div className="col-span-2 font-semibold mt-4">Documents</div>
                <div><label>Member Photo</label><Input name="photoUrl" type="file" accept="image/*" /></div>
                <div><label>ID Proof</label><Input name="idProofUrl" type="file" /></div>
                <div className="col-span-2 font-semibold mt-4">Membership</div>
                <div className="col-span-2"><label>Membership Plan</label><Select name="planId" defaultValue={membershipPlans[0]?.id} required><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{membershipPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent></Select></div>
                <DialogFooter className="col-span-2 mt-4"><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Member"}</Button></DialogFooter>
              </form>
            </TabsContent>
            <TabsContent value="share">
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">Select a plan to generate a unique signup link.</p>
                <div><label>Membership Plan</label><Select value={shareablePlanId} onValueChange={setShareablePlanId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{membershipPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="relative"><Input value={shareLink} readOnly /><Button size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7" onClick={copyToClipboard}><ClipboardCopy className="h-4 w-4" /></Button></div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Member Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Member Details</DialogTitle></DialogHeader>
          <form action={(fd) => handleFormAction(updateMember.bind(null, selectedMember!.id, gymId), fd)} className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 font-semibold">Personal Details</div>
            <div><label>Full Name</label><Input name="name" defaultValue={selectedMember?.name} required /></div>
            <div><label>Email</label><Input name="email" type="email" defaultValue={selectedMember?.email} required /></div>
            <div><label>Phone</label><Input name="phone" defaultValue={selectedMember?.phone ?? ""} /></div>
            <div><label>Gender</label><Select name="gender" defaultValue={selectedMember?.gender ?? ""}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
            <div><label>Date of Birth</label><Input name="dateOfBirth" type="date" defaultValue={selectedMember?.dateOfBirth ? format(new Date(selectedMember.dateOfBirth), 'yyyy-MM-dd') : ''} /></div>
            <div><label>Joining Date</label><Input name="joinedAt" type="date" defaultValue={format(selectedMember?.joinedAt ? new Date(selectedMember.joinedAt) : new Date(), 'yyyy-MM-dd')} required disabled={!isProPlan} /></div>
            <div><label>Weight (kg)</label><Input name="weightKg" type="number" step="0.1" defaultValue={selectedMember?.weightKg ?? ""} /></div>
            <div><label>Height (cm)</label><Input name="heightCm" type="number" step="0.1" defaultValue={selectedMember?.heightCm ?? ""} /></div>
            <div className="col-span-2 font-semibold mt-4">Documents</div>
            <div>
              <label>Member Photo</label>
              <Input name="photoUrl" type="file" accept="image/*" />
              {selectedMember?.photoUrl && <a href={selectedMember.photoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs mt-1 block">View Current Photo</a>}
            </div>
            <div>
              <label>ID Proof</label>
              <Input name="idProofUrl" type="file" />
              {selectedMember?.idProofUrl && <a href={selectedMember.idProofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs mt-1 block">View Current ID</a>}
            </div>
            <div className="col-span-2 font-semibold mt-4">Membership</div>
            <div className="col-span-2"><label>Membership Plan</label><Select name="planId" defaultValue={selectedMember?.planId} required disabled={!isProPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{membershipPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent></Select></div>
            <DialogFooter className="col-span-2 mt-4"><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Renew Modal */}
      <Dialog open={isRenewModalOpen} onOpenChange={setRenewModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renew Membership</DialogTitle></DialogHeader>
          <form action={handleRenew}>
            <div className="space-y-4 py-4">
              <p>Renew <strong>{selectedMember?.name}'s</strong> membership.</p>
              <div>
                <label>Membership Plan</label>
                <Select name="planId" defaultValue={selectedMember?.planId} required disabled={!isProPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{membershipPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent>
                </Select>
                {!isProPlan && <p className="text-xs text-muted-foreground mt-1">Upgrade to Pro to change plans upon renewal.</p>}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Renewing..." : "Confirm Renewal"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Are you sure?</DialogTitle></DialogHeader>
          <DialogDescription>This will permanently delete {selectedMember?.name}.</DialogDescription>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>{isSubmitting ? "Deleting..." : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
