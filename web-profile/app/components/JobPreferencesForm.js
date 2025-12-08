"use client";
import { useState, useEffect, useMemo } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function JobPreferencesForm({ session }) {
    const supabase = useMemo(() => getSupabaseClient(), []);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        question_hear_about: "",
        question_used_product: "",
        question_worked_before: "",
        question_pronouns: "",
        question_work_auth: "",
        question_sponsorship: "",
        question_office_willingness: "",
        question_office_location: "",
        question_conflict_interest: "",
        question_conflict_details: "",
        question_gov_official: "",
        question_gov_details: "",
        question_gender: "",
        question_lgbtq: "",
        question_military_status: ""
    });

    useEffect(() => {
        fetchProfile();
    }, [session]);

    const fetchProfile = async () => {
        if (!session?.user?.id) return;
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", session.user.id)
                .single();

            if (error && error.code !== "PGRST116") {
                console.error("Error fetching preferences:", error);
            } else if (data) {
                setFormData((prev) => ({ ...prev, ...data }));
            }
        } catch (err) {
            console.error("Exception fetching preferences:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .upsert({
                    id: session.user.id,
                    ...formData,
                    updated_at: new Date().toISOString(),
                });

            if (error) alert("Error saving: " + error.message);
            else alert("Preferences saved successfully!");
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto p-4 bg-white shadow rounded-lg">
            <h2 className="text-xl font-bold border-b pb-2 mb-4">Job Application Preferences</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-700">General Questions</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">How did you hear about this job?</label>
                        <select name="question_hear_about" value={formData.question_hear_about || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="LinkedIn">LinkedIn</option>
                            <option value="Indeed">Indeed</option>
                            <option value="Glassdoor">Glassdoor</option>
                            <option value="Company Website">Company Website</option>
                            <option value="Referral">Referral</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Have you used our product?</label>
                        <select name="question_used_product" value={formData.question_used_product || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Have you worked here before (Employee/Intern)?</label>
                        <select name="question_worked_before" value={formData.question_worked_before || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>
                </div>

                {/* Legal & Work */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-700">Work Authorization</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Are you legally authorized to work in US?</label>
                        <select name="question_work_auth" value={formData.question_work_auth || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Will you require sponsorship?</label>
                        <select name="question_sponsorship" value={formData.question_sponsorship || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Willing to work from listed office?</label>
                        <select name="question_office_willingness" value={formData.question_office_willingness || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Preferred Office Location</label>
                        <input type="text" name="question_office_location" value={formData.question_office_location || ""} onChange={handleChange} placeholder="e.g. Seattle, WA" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    </div>
                </div>

                {/* Demographics / EEO */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-700">Demographics (EEO)</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Pronouns</label>
                        <select name="question_pronouns" value={formData.question_pronouns || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="He/Him">He/Him</option>
                            <option value="She/Her">She/Her</option>
                            <option value="They/Them">They/Them</option>
                            <option value="Decline">Decline to State</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Gender Identity</label>
                        <select name="question_gender" value={formData.question_gender || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Non-binary">Non-binary</option>
                            <option value="Decline">Decline to State</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">LGBTQ+ Community?</label>
                        <select name="question_lgbtq" value={formData.question_lgbtq || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="Decline">Decline to State</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Military Status</label>
                        <select name="question_military_status" value={formData.question_military_status || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Veteran">Veteran</option>
                            <option value="Not a Veteran">Not a Veteran</option>
                            <option value="Decline">Decline to State</option>
                        </select>
                    </div>
                </div>

                {/* Compliance / Disclosures */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-700">Compliance & Conflicts</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Conflict of Interest / Relationships?</label>
                        <select name="question_conflict_interest" value={formData.question_conflict_interest || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>
                    {formData.question_conflict_interest === "Yes" && (
                        <textarea name="question_conflict_details" value={formData.question_conflict_details || ""} onChange={handleChange} placeholder="Please provide details..." className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border h-20" />
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Government Official Connection?</label>
                        <select name="question_gov_official" value={formData.question_gov_official || ""} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>
                    {formData.question_gov_official === "Yes" && (
                        <textarea name="question_gov_details" value={formData.question_gov_details || ""} onChange={handleChange} placeholder="Please provide details..." className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border h-20" />
                    )}
                </div>

            </div>

            <div className="mt-6">
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 font-bold transition disabled:opacity-50"
                >
                    {saving ? "Saving Preferences..." : "Save Job Preferences"}
                </button>
            </div>
        </form>
    );
}
