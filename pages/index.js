import dynamic from 'next/dynamic'
import Head from 'next/head'

const StarChart = dynamic(() => import('../components/StarChart'), { ssr: false })

export default function Home() {
  return (
    <>
      <Head>
        <title>Star Base One : Sky Chart</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <StarChart />
    </>
  )
}