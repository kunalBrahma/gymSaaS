"use client";

import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { toast } from "sonner";
import { format } from "date-fns";
import { ClipboardCopy, Upload, X, Loader2 } from "lucide-react";
import { useState, useCallback, useMemo, useEffect } from "react"; // Added useEffect import
import { useDebounce } from "use-debounce";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createMember, checkEmailAvailability } from "./actions";
import type { MembershipPlan, CustomField } from "@prisma/client";

// Define types for server action responses
interface CheckEmailResponse {
  success: boolean;
  available?: boolean;
  message?: string;
  errorCode?: string;
}

interface CreateMemberResponse {
  success: boolean;
  message: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
}

interface MemberFormData {
  name: string;
  email: string;
  planId: string;
  joinedAt: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  weightKg?: string;
  heightCm?: string;
  photoUrl?: FileList;
  idProofUrl?: FileList;
  [key: string]: any;
}

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  gymId: string;
  membershipPlans: MembershipPlan[];
  customFields: CustomField[];
  isProPlan: boolean;
  shareLink: string;
  shareablePlanId: string | undefined;
  setShareablePlanId: (id: string) => void;
  copyToClipboard: () => void;
}

interface FileUploadState {
  photo: { file: File | null; preview: string | null; error: string | null };
  idProof: { file: File | null; preview: string | null; error: string | null };
}

export function AddMemberModal({
  isOpen,
  onClose,
  gymId,
  membershipPlans,
  customFields,
  isProPlan,
  shareLink,
  shareablePlanId,
  setShareablePlanId,
  copyToClipboard,
}: AddMemberModalProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
    photo: { file: null, preview: null, error: null },
    idProof: { file: null, preview: null, error: null },
  });
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [debouncedEmail] = useDebounce(emailInput, 500);

  // Memoize default values to prevent unnecessary re-renders
  const defaultValues = useMemo(
    () => ({
      joinedAt: format(new Date(), "yyyy-MM-dd"),
      planId: membershipPlans[0]?.id || "",
      name: "",
      email: "",
      phone: "",
      address: "",
      gender: "not_specified",
      weightKg: "",
      heightCm: "",
      dateOfBirth: "",
    }),
    [membershipPlans]
  );

  const form = useForm<MemberFormData>({
    defaultValues,
    mode: "onChange",
  });

  const { isSubmitting, errors } = form.formState;

  // Real-time email validation
  useEffect(() => {
    if (debouncedEmail) {
      setIsCheckingEmail(true);
      const checkEmail = async () => {
        try {
          const response: CheckEmailResponse = await checkEmailAvailability(
            gymId,
            debouncedEmail
          );
          setIsCheckingEmail(false);
          if (response.success && typeof response.available === "boolean") {
            setEmailAvailable(response.available);
            if (!response.available) {
              form.setError("email", {
                type: "manual",
                message: "This email is already registered for this gym.",
              });
            } else {
              form.clearErrors("email");
            }
          } else if (!response.success) {
            toast.error(
              response.message || "Failed to check email availability."
            );
            setEmailAvailable(null);
          }
        } catch (error) {
          setIsCheckingEmail(false);
          toast.error("Failed to check email availability.");
          setEmailAvailable(null);
        }
      };
      checkEmail();
    } else {
      setIsCheckingEmail(false);
      setEmailAvailable(null);
      form.clearErrors("email");
    }
  }, [debouncedEmail, gymId, form]);

  // File validation helper
  const validateFile = useCallback(
    (file: File, type: "photo" | "idProof"): string | null => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes =
        type === "photo"
          ? ["image/jpeg", "image/png", "image/webp"]
          : ["image/jpeg", "image/png", "image/webp", "application/pdf"];

      if (file.size > maxSize) {
        return `File too large. Maximum size is 5MB.`;
      }

      if (!allowedTypes.includes(file.type)) {
        return `Invalid file type. ${
          type === "photo" ? "Only images" : "Only images and PDFs"
        } are allowed.`;
      }

      return null;
    },
    []
  );

  // Handle file selection with validation and preview
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, type: "photo" | "idProof") => {
      const file = event.target.files?.[0];

      if (!file) {
        setFileUploadState((prev) => ({
          ...prev,
          [type]: { file: null, preview: null, error: null },
        }));
        return;
      }

      const error = validateFile(file, type);

      if (error) {
        setFileUploadState((prev) => ({
          ...prev,
          [type]: { file: null, preview: null, error },
        }));
        toast.error(error);
        return;
      }

      // Create preview for images
      let preview: string | null = null;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }

      setFileUploadState((prev) => ({
        ...prev,
        [type]: { file, preview, error: null },
      }));

      // Update form data
      const fileList = new DataTransfer();
      fileList.items.add(file);
      form.setValue(
        type === "photo" ? "photoUrl" : "idProofUrl",
        fileList.files
      );
    },
    [validateFile, form]
  );

  // Remove file
  const removeFile = useCallback(
    (type: "photo" | "idProof") => {
      setFileUploadState((prev) => {
        if (prev[type].preview) {
          URL.revokeObjectURL(prev[type].preview!);
        }
        return {
          ...prev,
          [type]: { file: null, preview: null, error: null },
        };
      });
      form.setValue(type === "photo" ? "photoUrl" : "idProofUrl", undefined);
    },
    [form]
  );

  const onSubmit: SubmitHandler<MemberFormData> = async (data) => {
    // Prevent submission if email is not available
    if (emailAvailable === false) {
      toast.error("Please use a different email address.");
      return;
    }

    try {
      setUploadProgress(10);
      console.log("=== OPTIMIZED FORM SUBMIT ===");

      // Client-side validation with better error messages
      const validationErrors: string[] = [];

      if (!data.name?.trim() || data.name.trim().length < 2) {
        validationErrors.push("Name must be at least 2 characters");
      }

      if (
        !data.email?.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())
      ) {
        validationErrors.push("Please enter a valid email address");
      }

      if (!data.planId) {
        validationErrors.push("Please select a membership plan");
      }

      if (!data.joinedAt) {
        validationErrors.push("Please select a joining date");
      }

      // Check for file upload errors
      if (fileUploadState.photo.error) {
        validationErrors.push(fileUploadState.photo.error);
      }
      if (fileUploadState.idProof.error) {
        validationErrors.push(fileUploadState.idProof.error);
      }

      if (validationErrors.length > 0) {
        validationErrors.forEach((error) => toast.error(error));
        setUploadProgress(0);
        return;
      }

      setUploadProgress(30);

      // Prepare FormData with optimized field handling
      const formData = new FormData();

      // Required fields
      formData.append("name", data.name.trim());
      formData.append("email", data.email.toLowerCase().trim());
      formData.append("planId", data.planId);
      formData.append("joinedAt", data.joinedAt);

      // Optional fields (only append if they have meaningful values)
      const optionalFields = [
        { key: "phone", value: data.phone?.trim() },
        { key: "address", value: data.address?.trim() },
        { key: "gender", value: data.gender?.trim() },
        { key: "dateOfBirth", value: data.dateOfBirth },
      ];

      optionalFields.forEach(({ key, value }) => {
        if (value && value !== "") {
          formData.append(key, value);
        }
      });

      // Numeric fields with validation
      if (
        data.weightKg &&
        !isNaN(Number(data.weightKg)) &&
        Number(data.weightKg) > 0
      ) {
        formData.append("weightKg", data.weightKg);
      }
      if (
        data.heightCm &&
        !isNaN(Number(data.heightCm)) &&
        Number(data.heightCm) > 0
      ) {
        formData.append("heightCm", data.heightCm);
      }

      setUploadProgress(50);

      // Handle file uploads with actual files from state
      if (fileUploadState.photo.file) {
        formData.append("photoUrl", fileUploadState.photo.file);
      }
      if (fileUploadState.idProof.file) {
        formData.append("idProofUrl", fileUploadState.idProof.file);
      }

      // Custom fields for pro plans
      if (isProPlan && customFields.length > 0) {
        customFields.forEach((field) => {
          const customValue = data[`custom_${field.id}`];
          if (customValue != null && customValue !== "") {
            formData.append(`custom_${field.id}`, String(customValue));
          }
        });
      }

      setUploadProgress(70);

      console.log("Submitting form with files:", {
        photo: fileUploadState.photo.file?.name,
        idProof: fileUploadState.idProof.file?.name,
        formDataSize: Array.from(formData.entries()).length,
      });

      // Submit to server action
      const result: CreateMemberResponse = await createMember(gymId, formData);

      setUploadProgress(100);
      console.log("Server action result:", result);

      if (result.success) {
        toast.success(result.message);
        handleModalClose();
      } else {
        toast.error(result.message);

        // Handle server-side email validation error
        if (result.errorCode === "EMAIL_ALREADY_EXISTS") {
          form.setError("email", {
            type: "manual",
            message: "This email is already registered for this gym.",
          });
        }

        // Handle other validation errors from server
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              toast.error(`${field}: ${messages[0]}`);
            }
          });
        }
      }
    } catch (error: any) {
      console.error("Form submission error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setUploadProgress(0);
    }
  };

  const handleModalClose = useCallback(() => {
    // Clean up file previews
    if (fileUploadState.photo.preview) {
      URL.revokeObjectURL(fileUploadState.photo.preview);
    }
    if (fileUploadState.idProof.preview) {
      URL.revokeObjectURL(fileUploadState.idProof.preview);
    }

    // Reset file state
    setFileUploadState({
      photo: { file: null, preview: null, error: null },
      idProof: { file: null, preview: null, error: null },
    });

    // Reset email validation state
    setEmailAvailable(null);
    setIsCheckingEmail(false);
    setEmailInput("");

    // Reset form
    form.reset(defaultValues);
    setUploadProgress(0);
    onClose();
  }, [fileUploadState, form, defaultValues, onClose]);

  // File upload component
  const FileUploadField = ({
    type,
    label,
    accept,
  }: {
    type: "photo" | "idProof";
    label: string;
    accept: string;
  }) => {
    const fileState = fileUploadState[type];

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">{label}</label>

        {!fileState.file ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <Input
              type="file"
              accept={accept}
              onChange={(e) => handleFileSelect(e, type)}
              className="hidden"
              id={`file-${type}`}
            />
            <label htmlFor={`file-${type}`} className="cursor-pointer">
              <span className="text-sm text-gray-600">
                Click to upload {label.toLowerCase()}
              </span>
              <br />
              <span className="text-xs text-gray-400">
                Max 5MB, {type === "photo" ? "Images only" : "Images or PDF"}
              </span>
            </label>
          </div>
        ) : (
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {fileState.preview && (
                  <img
                    src={fileState.preview}
                    alt="Preview"
                    className="h-12 w-12 object-cover rounded"
                  />
                )}
                <div>
                  <p className="text-sm font-medium">{fileState.file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(fileState.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(type)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {fileState.error && (
          <Alert variant="destructive">
            <AlertDescription>{fileState.error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
        </DialogHeader>

        {/* Progress bar for uploads */}
        {uploadProgress > 0 && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {uploadProgress < 50
                ? "Validating..."
                : uploadProgress < 90
                ? "Uploading..."
                : "Finalizing..."}
            </p>
          </div>
        )}

        <Tabs defaultValue="manual" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="share" disabled={!isProPlan}>
              Share Link {!isProPlan && "(Pro Only)"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="overflow-hidden">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                {/* Personal Details Section */}
                <div className="col-span-2 font-semibold text-lg border-b pb-2 text-blue-600">
                  Personal Details
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    {...form.register("name", {
                      required: "Name is required",
                      minLength: {
                        value: 2,
                        message: "Name must be at least 2 characters",
                      },
                      pattern: {
                        value: /^[a-zA-Z\s]+$/,
                        message: "Name should only contain letters and spaces",
                      },
                    })}
                    placeholder="Enter full name"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <span className="text-xs text-red-500">
                      {errors.name.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    {...form.register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Invalid email format",
                      },
                    })}
                    onChange={(e) => {
                      form.setValue("email", e.target.value);
                      setEmailInput(e.target.value);
                    }}
                    placeholder="Enter email address"
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {isCheckingEmail && (
                    <span className="text-xs text-gray-500">Checking...</span>
                  )}
                  {errors.email && (
                    <span className="text-xs text-red-500">
                      {errors.email.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    {...form.register("phone", {
                      pattern: {
                        value: /^[+]?[\d\s-()]+$/,
                        message: "Invalid phone number format",
                      },
                    })}
                    placeholder="Enter phone number"
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <span className="text-xs text-red-500">
                      {errors.phone.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Gender</label>
                  <Controller
                    name="gender"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_specified">
                            Not specified
                          </SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date of Birth</label>
                  <Input
                    type="date"
                    {...form.register("dateOfBirth", {
                      validate: (value) => {
                        if (!value) return true;
                        const birthDate = new Date(value);
                        const today = new Date();
                        const age =
                          today.getFullYear() - birthDate.getFullYear();
                        return (
                          (age >= 10 && age <= 100) ||
                          "Please enter a valid birth date"
                        );
                      },
                    })}
                    max={format(new Date(), "yyyy-MM-dd")}
                  />
                  {errors.dateOfBirth && (
                    <span className="text-xs text-red-500">
                      {errors.dateOfBirth.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Joining Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    {...form.register("joinedAt", {
                      required: "Joining date is required",
                    })}
                    className={errors.joinedAt ? "border-red-500" : ""}
                  />
                  {errors.joinedAt && (
                    <span className="text-xs text-red-500">
                      {errors.joinedAt.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Weight (kg)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="20"
                    max="300"
                    {...form.register("weightKg", {
                      validate: (value) => {
                        if (!value) return true;
                        const weight = Number(value);
                        return (
                          (weight >= 20 && weight <= 300) ||
                          "Weight must be between 20-300 kg"
                        );
                      },
                    })}
                    placeholder="Enter weight"
                  />
                  {errors.weightKg && (
                    <span className="text-xs text-red-500">
                      {errors.weightKg.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Height (cm)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="100"
                    max="250"
                    {...form.register("heightCm", {
                      validate: (value) => {
                        if (!value) return true;
                        const height = Number(value);
                        return (
                          (height >= 100 && height <= 250) ||
                          "Height must be between 100-250 cm"
                        );
                      },
                    })}
                    placeholder="Enter height"
                  />
                  {errors.heightCm && (
                    <span className="text-xs text-red-500">
                      {errors.heightCm.message}
                    </span>
                  )}
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium">Address</label>
                  <Textarea
                    {...form.register("address")}
                    placeholder="Enter complete address"
                    rows={2}
                  />
                </div>

                {/* Custom Fields for Pro Plan */}
                {isProPlan && customFields.length > 0 && (
                  <>
                    <div className="col-span-2 font-semibold text-lg border-b pb-2 mt-4 text-blue-600">
                      Additional Information
                    </div>
                    {customFields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <label className="text-sm font-medium">
                          {field.name}
                          {field.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        <Input
                          {...form.register(`custom_${field.id}`, {
                            required: field.required
                              ? `${field.name} is required`
                              : false,
                          })}
                          type={field.type}
                          placeholder={`Enter ${field.name.toLowerCase()}`}
                          className={
                            errors[`custom_${field.id}`] ? "border-red-500" : ""
                          }
                        />
                        {errors[`custom_${field.id}`] && (
                          <span className="text-xs text-red-500">
                            {String(errors[`custom_${field.id}`]?.message)}
                          </span>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Documents Section */}
                <div className="col-span-2 font-semibold text-lg border-b pb-2 mt-4 text-blue-600">
                  Documents
                </div>

                <FileUploadField
                  type="photo"
                  label="Member Photo"
                  accept="image/*"
                />

                <FileUploadField
                  type="idProof"
                  label="ID Proof"
                  accept="image/*,.pdf"
                />

                {/* Membership Section */}
                <div className="col-span-2 font-semibold text-lg border-b pb-2 mt-4 text-blue-600">
                  Membership Details
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium">
                    Membership Plan <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="planId"
                    control={form.control}
                    rules={{ required: "Please select a membership plan" }}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger
                          className={errors.planId ? "border-red-500" : ""}
                        >
                          <SelectValue placeholder="Select a membership plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {membershipPlans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{plan.name}</span>
                                <span className="text-xs text-gray-500">
                                  ₹{(Number(plan.price) / 100).toFixed(2)} for{" "}
                                  {plan.durationMonths} months
                                  {plan.admissionFee > 0 &&
                                    ` + ₹${(
                                      Number(plan.admissionFee) / 100
                                    ).toFixed(2)} admission`}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.planId && (
                    <span className="text-xs text-red-500">
                      {errors.planId.message}
                    </span>
                  )}
                </div>
              </div>

              <DialogFooter className="mt-6 flex-shrink-0">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleModalClose}
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    uploadProgress > 0 ||
                    emailAvailable === false
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding Member...
                    </>
                  ) : (
                    "Add Member"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="share">
            <div className="space-y-6 pt-4">
              <Alert>
                <AlertDescription>
                  Generate a signup link that allows potential members to
                  register themselves with a pre-selected plan.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Select Membership Plan
                </label>
                <Select
                  value={shareablePlanId}
                  onValueChange={setShareablePlanId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a plan for the signup link" />
                  </SelectTrigger>
                  <SelectContent>
                    {membershipPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{plan.name}</span>
                          <span className="text-xs text-gray-500">
                            ₹{plan.price} for {plan.durationMonths} months
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {shareablePlanId && shareLink && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Shareable Registration Link
                  </label>
                  <div className="relative">
                    <Input
                      value={shareLink}
                      readOnly
                      className="pr-20 bg-gray-50"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <Button
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3"
                      onClick={copyToClipboard}
                      type="button"
                    >
                      <ClipboardCopy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium mb-1">
                      How to use:
                    </p>
                    <ul className="text-xs text-blue-600 space-y-1">
                      <li>
                        • Share this link via WhatsApp, email, or social media
                      </li>
                      <li>
                        • New members can register directly using this link
                      </li>
                      <li>
                        • They'll be automatically assigned to the selected plan
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
