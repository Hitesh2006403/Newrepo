# Share A Plate - Feature Overview: User-Chosen Priority

### Presentation & Executive Summary (PPT-Ready)

> **Share A Plate: Intelligent Dual-Tier Priority & Expiry Orchestration**  
> We have introduced user-chosen Priority (`LOW`, `MEDIUM`, `HIGH`) across the entire platform, giving both food donors and recipient welfare shelters direct agency over how their donations and community requirements are triaged. Crucially decoupled from automatic food expiry countdowns, this user-selected priority boosts smart matching scores by up to +6 points, accelerates rapid delivery vehicle dispatch, triggers real-time in-app alerts for high-priority emergency needs, and equips donors and recipients with flexible filtering, sorting, and conditional editing capabilities—all while maintaining ironclad safety buffers, strict zero-trust validation, and full backward compatibility across all modules.

---

### Key Capabilities at a Glance

1. **User Empowerment with Safety Guarantees**: Donors and shelters set operational urgency directly (`LOW`, `MEDIUM`, `HIGH`), independent of biochemical food shelf-life calculations.
2. **Explainable AI Matching**: Priority provides a clean, transparent server-computed boost (`priorityBoost`) in smart match recommendations without allowing priority to override safety margins or quantity limits.
3. **Automated Emergency Dispatch Radar**: High-priority donations automatically notify matching verified shelters and rank atop driver and Porter fleet dispatch radars.
4. **Conditional Lifecycle Control**: Safe atomic editing (`PATCH`) allows donors and recipients to adjust priority while records remain open and unclaimed, secured against race conditions and IDOR vulnerabilities.
5. **Harmonious Backward Compatibility**: Legacy client requests using deprecated `urgency` fields seamlessly map to the new priority architecture with zero breaking changes.
