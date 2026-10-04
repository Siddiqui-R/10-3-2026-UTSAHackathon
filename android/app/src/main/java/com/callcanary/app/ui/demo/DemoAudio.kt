package com.callcanary.app.ui.demo

import android.content.Context
import android.media.MediaPlayer
import kotlinx.coroutines.delay

/**
 * Plays a bundled clip until it ends, or until [stopAt] (0..1) of it has played, e.g. when CallCanary cuts a scam caller off.
 * [onProgress] gets 0..1 so captions can follow the voice. Cancelling the coroutine (skipping a scene) stops the audio.
 * If playback isn't possible, it waits [fallbackMs] while still reporting progress.
 */
suspend fun playClip(context: Context, resId: Int, fallbackMs: Long = 4000, stopAt: Float = 1f, onProgress: (Float) -> Unit = {}) {
    val player = runCatching { MediaPlayer.create(context, resId) }.getOrNull()
    if (player == null) {
        val steps = (fallbackMs / 120).coerceAtLeast(1)
        for (i in 1..steps) { onProgress(i.toFloat() / steps * stopAt); delay(120) }
        return
    }
    var finished = false
    player.setOnCompletionListener { finished = true }
    player.setOnErrorListener { _, _, _ -> finished = true; true }
    try {
        player.start()
        val duration = player.duration.coerceAtLeast(1)
        while (!finished) {
            val progress = (player.currentPosition.toFloat() / duration).coerceIn(0f, 1f)
            onProgress(progress)
            if (progress >= stopAt) break
            delay(120)
        }
        onProgress(if (finished) 1f else stopAt)
    } finally {
        runCatching { player.stop() }
        player.release()
    }
}
