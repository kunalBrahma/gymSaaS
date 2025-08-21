"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
  TableState,
} from "@tanstack/react-table";
import {
  MoreHorizontal,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Users,
  Calendar,
  Mail,
  CreditCard,
  ChevronDown,
  Edit,
  Trash2,
  X,
  Archive,
} from "lucide-react";
import { format, isBefore, addDays, isAfter } from "date-fns";
import Link from "next/link";
import Image from "next/image";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Member, MembershipPlan } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Extend TableState to include statusFilter
interface CustomTableState extends TableState {
  statusFilter: string;
}

type MemberWithPlan = Member & { plan: MembershipPlan };

interface MembersTableProps {
  initialMembers: MemberWithPlan[];
  gymId: string;
  onEdit: (member: MemberWithPlan) => void;
  onDelete: (member: MemberWithPlan) => void;
  onRenew: (member: MemberWithPlan) => void;
}

export function MembersTable({
  initialMembers,
  gymId,
  onEdit,
  onDelete,
  onRenew,
}: MembersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active"); // New state for active/archived filter
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Enhanced data filtering with multiple status options and soft delete
  const data = useMemo(() => {
    let filteredData = initialMembers;

    // Filter by active/archived status
    if (statusFilter === "active") {
      filteredData = filteredData.filter((member) => member.deletedAt === null);
    } else if (statusFilter === "archived") {
      filteredData = filteredData.filter((member) => member.deletedAt !== null);
    }

    // Apply expiry filters
    if (expiryFilter === "expiring") {
      const oneWeekFromNow = addDays(new Date(), 7);
      filteredData = filteredData.filter(
        (member) =>
          member.membershipExpiresAt &&
          isBefore(new Date(member.membershipExpiresAt), oneWeekFromNow) &&
          isAfter(new Date(member.membershipExpiresAt), new Date())
      );
    } else if (expiryFilter === "expired") {
      filteredData = filteredData.filter(
        (member) =>
          member.membershipExpiresAt &&
          isBefore(new Date(member.membershipExpiresAt), new Date())
      );
    } else if (expiryFilter === "active") {
      filteredData = filteredData.filter(
        (member) =>
          member.membershipExpiresAt &&
          isAfter(new Date(member.membershipExpiresAt), new Date())
      );
    }

    return filteredData;
  }, [initialMembers, expiryFilter, statusFilter]);

  // Enhanced status badge function
  const getStatusBadge = useCallback((member: MemberWithPlan) => {
    if (member.deletedAt !== null) {
      return <Badge variant="secondary">Archived</Badge>;
    }
    if (!member.membershipExpiresAt) {
      return <Badge variant="secondary">No Expiry</Badge>;
    }

    const expiryDate = new Date(member.membershipExpiresAt);
    const now = new Date();
    const oneWeekFromNow = addDays(now, 7);

    if (isBefore(expiryDate, now)) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (isBefore(expiryDate, oneWeekFromNow)) {
      return (
        <Badge
          variant="destructive"
          className="bg-orange-500 hover:bg-orange-600"
        >
          Expiring Soon
        </Badge>
      );
    } else {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          Active
        </Badge>
      );
    }
  }, []);

  const columns: ColumnDef<MemberWithPlan>[] = [
    {
      accessorKey: "name",
      header: "Member",
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-0">
          {row.original.photoUrl ? (
            <Image
              src={row.original.photoUrl}
              alt={`${row.original.name}'s profile`}
              width={40}
              height={40}
              className="rounded-full h-10 w-10 object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-medium text-white text-sm flex-shrink-0">
              {row.original.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate">
              {row.original.name}
            </p>
            <p className="text-sm text-muted-foreground truncate md:hidden">
              {row.original.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <div className="hidden md:block">
          <p
            className="text-sm truncate max-w-[200px]"
            title={row.original.email}
          >
            {row.original.email}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "plan.name",
      header: "Plan",
      cell: ({ row }) => (
        <div className="font-medium text-sm bg-muted/50 px-2 py-1 rounded-md inline-block">
          {row.original.plan?.name || "No Plan"}
        </div>
      ),
    },
    {
      accessorKey: "membershipExpiresAt",
      header: "Status",
      cell: ({ row }) => (
        <div className="space-y-1">
          {getStatusBadge(row.original)}
          {row.original.membershipExpiresAt && (
            <p className="text-xs text-muted-foreground hidden md:block">
              {format(
                new Date(row.original.membershipExpiresAt),
                "MMM dd, yyyy"
              )}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">
                  Open menu for {row.original.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px]">
              <DropdownMenuItem asChild>
                <Link
                  href={`/dashboard/${gymId}/members/${row.original.id}`}
                  className="flex items-center cursor-pointer"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRenew(row.original)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Renew
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => onDelete(row.original)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {row.original.deletedAt ? "Restore" : "Archive"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, statusFilter } as CustomTableState, // Use custom state type
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  // Mobile card component for better mobile experience
  const MobileCard = ({ member }: { member: MemberWithPlan }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {member.photoUrl ? (
              <Image
                src={member.photoUrl}
                alt={`${member.name}'s profile`}
                width={48}
                height={48}
                className="rounded-full h-12 w-12 object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-medium text-white flex-shrink-0">
                {member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate">
                {member.name}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {member.email}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/${gymId}/members/${member.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRenew(member)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Renew
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(member)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => onDelete(member)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {member.deletedAt ? "Restore" : "Archive"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {member.plan?.name || "No Plan"}
              </span>
            </div>
            {member.membershipExpiresAt && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {format(new Date(member.membershipExpiresAt), "MMM dd")}
                </span>
              </div>
            )}
          </div>
          {getStatusBadge(member)}
        </div>
      </CardContent>
    </Card>
  );

  const clearFilters = () => {
    setGlobalFilter("");
    setExpiryFilter("all");
    setStatusFilter("active");
  };

  const hasActiveFilters = globalFilter || expiryFilter !== "all" || statusFilter !== "active";

  return (
    <div className="space-y-4">
      {/* Enhanced Filter Section */}
      <div className="space-y-4">
        {/* Desktop Filters */}
        <div className="hidden md:flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members by name or email..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 pr-4"
              />
              {globalFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setGlobalFilter("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Archive className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Members</SelectItem>
                <SelectItem value="archived">Archived Members</SelectItem>
                <SelectItem value="all">All Members</SelectItem>
              </SelectContent>
            </Select>
            <Select value={expiryFilter} onValueChange={setExpiryFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by expiry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Expiry</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Filters */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 mr-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
              <ChevronDown
                className={`h-4 w-4 ml-1 transition-transform ${
                  showMobileFilters ? "rotate-180" : ""
                }`}
              />
            </Button>
          </div>

          {showMobileFilters && (
            <div className="flex flex-col gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Member Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Members</SelectItem>
                  <SelectItem value="archived">Archived Members</SelectItem>
                  <SelectItem value="all">All Members</SelectItem>
                </SelectContent>
              </Select>
              <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Expiry Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Expiry</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>
              Showing {table.getRowModel().rows.length} of{" "}
              {initialMembers.length} members
              {hasActiveFilters && " (filtered)"}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="font-semibold text-foreground"
                    >
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
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-4">
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
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="h-8 w-8" />
                      <p>No members found</p>
                      {hasActiveFilters && (
                        <Button variant="link" size="sm" onClick={clearFilters}>
                          Clear filters to see all members
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {table.getRowModel().rows.length ? (
          table
            .getRowModel()
            .rows.map((row) => (
              <MobileCard key={row.id} member={row.original} />
            ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Users className="h-12 w-12" />
                <div className="space-y-1">
                  <p className="font-medium">No members found</p>
                  <p className="text-sm">
                    Try adjusting your search or filters
                  </p>
                </div>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Enhanced Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()} ({data.length} total)
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="disabled:opacity-50"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}