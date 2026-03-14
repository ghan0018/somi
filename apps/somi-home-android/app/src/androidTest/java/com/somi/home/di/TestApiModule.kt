package com.somi.home.di

import com.somi.home.core.network.ApiService
import com.somi.home.fakes.FakeApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.components.SingletonComponent
import dagger.hilt.testing.TestInstallIn
import javax.inject.Singleton

@Module
@TestInstallIn(components = [SingletonComponent::class], replaces = [NetworkModule::class])
object TestApiModule {

    private val fakeApiService = FakeApiService()

    @Provides
    @Singleton
    fun provideFakeApiService(): ApiService = fakeApiService
}
