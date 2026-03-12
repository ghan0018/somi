package com.somi.home.di

import android.content.Context
import androidx.room.Room
import com.somi.home.core.database.AppDatabase
import com.somi.home.core.database.PendingCompletionDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "somi_home_db").build()

    @Provides
    fun providePendingCompletionDao(db: AppDatabase): PendingCompletionDao =
        db.pendingCompletionDao()
}
