package com.somi.home.today

import com.somi.home.core.models.ExerciseParams
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class EffectiveParamsTest {

    /**
     * Computes effective exercise parameters by merging defaultParams with paramsOverride.
     * Override values win; null override fields fall through to defaults.
     */
    private fun effectiveParams(
        defaultParams: ExerciseParams,
        paramsOverride: ExerciseParams?
    ): ExerciseParams {
        if (paramsOverride == null) return defaultParams
        return ExerciseParams(
            reps = paramsOverride.reps ?: defaultParams.reps,
            sets = paramsOverride.sets ?: defaultParams.sets,
            seconds = paramsOverride.seconds ?: defaultParams.seconds
        )
    }

    @Test
    fun `returns defaultParams when override is null`() {
        val defaults = ExerciseParams(reps = 10, sets = 3, seconds = 30)
        val result = effectiveParams(defaults, null)
        assertEquals(10, result.reps)
        assertEquals(3, result.sets)
        assertEquals(30, result.seconds)
    }

    @Test
    fun `override wins over default for each param`() {
        val defaults = ExerciseParams(reps = 10, sets = 3, seconds = 30)
        val override = ExerciseParams(reps = 20, sets = 5, seconds = 60)
        val result = effectiveParams(defaults, override)
        assertEquals(20, result.reps)
        assertEquals(5, result.sets)
        assertEquals(60, result.seconds)
    }

    @Test
    fun `partial override merges correctly`() {
        val defaults = ExerciseParams(reps = 10, sets = 3, seconds = 30)
        val override = ExerciseParams(reps = 20, sets = null, seconds = null)
        val result = effectiveParams(defaults, override)
        assertEquals(20, result.reps)
        assertEquals(3, result.sets)
        assertEquals(30, result.seconds)
    }

    @Test
    fun `override with all nulls keeps defaults`() {
        val defaults = ExerciseParams(reps = 10, sets = 3, seconds = 30)
        val override = ExerciseParams(reps = null, sets = null, seconds = null)
        val result = effectiveParams(defaults, override)
        assertEquals(10, result.reps)
        assertEquals(3, result.sets)
        assertEquals(30, result.seconds)
    }

    @Test
    fun `defaults with null fields preserved when no override`() {
        val defaults = ExerciseParams(reps = null, sets = null, seconds = 60)
        val result = effectiveParams(defaults, null)
        assertNull(result.reps)
        assertNull(result.sets)
        assertEquals(60, result.seconds)
    }
}
