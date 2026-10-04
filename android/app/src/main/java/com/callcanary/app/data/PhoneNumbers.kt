package com.callcanary.app.data

/** US phone numbers, matching the website's lib/phoneNumber.ts. */
object PhoneNumbers {
    private val valid = Regex("^[2-9]\\d{2}[2-9]\\d{6}$")

    /** "(210) 555-0100", "+1 210 555 0100", "tel:+12105550100" → "2105550100", or null. */
    fun normalizeUs(input: String?): String? {
        if (input == null) return null
        val digits = input.filter { it.isDigit() }.let { if (it.length == 11 && it.startsWith("1")) it.drop(1) else it }
        return if (valid.matches(digits)) digits else null
    }

    fun format(digits: String): String =
        if (digits.length == 10) "(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}" else digits
}
