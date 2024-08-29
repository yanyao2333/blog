import categoryMapping from '@/data/category-mapping'
import siteMetadata from '@/data/siteMetadata'
import ListLayout from '@/layouts/ListLayoutWithCategories'
import { allBlogs, Blog } from 'contentlayer/generated'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CoreContent } from 'pliny/utils/contentlayer'
import { allCoreContent, sortPosts } from 'pliny/utils/contentlayer.js'
import { TreeNode } from '../../../contentlayer.config'
import { genPageMetadata } from '../../seo'
import categoryData from 'app/category-data.json'

export async function generateMetadata({
  params,
}: {
  params: { category: string[] }
}): Promise<Metadata> {
  const category = decodeURI(params.category.join('/'))
  return genPageMetadata({
    title: category,
    description: `${siteMetadata.title} - ${category} category`,
    alternates: {
      canonical: './',
      types: {
        'application/rss+xml': `${siteMetadata.siteUrl}/categories/${category}/feed.xml`,
      },
    },
  })
}

// 过滤文章：根据分类全路径查找节点，递归查找所有子节点下的文章
function filterPosts(categoryFullName: string, allPosts: CoreContent<Blog>[]): CoreContent<Blog>[] {
  // 递归查找节点
  function findNodeByFullPath(root: TreeNode, fullPath: string): TreeNode | null {
    if (root.fullPath === fullPath) {
      return root
    }

    for (const key in root.children) {
      const child = root.children[key]
      const result = findNodeByFullPath(child, fullPath)
      if (result) {
        return result
      }
    }

    return null
  }

  // 搜索当前分类及其子分类下的所有文章
  function deeplyFilterPosts(node: TreeNode, allPosts: CoreContent<Blog>[]): CoreContent<Blog>[] {
    let filteredPosts: CoreContent<Blog>[] = []
    if (node.fullPath === categoryFullName) {
      filteredPosts = filteredPosts.concat(
        allCoreContent(
          sortPosts(
            allBlogs.filter((post) => {
              return post._raw.sourceFileDir === node.fullPath ? post : null
            })
          )
        )
      )
    }
    for (const key in node.children) {
      filteredPosts = filteredPosts.concat(
        allCoreContent(
          sortPosts(
            allBlogs.filter((post) => {
              return post._raw.sourceFileDir === node.children[key].fullPath ? post : null
            })
          )
        )
      )
      filteredPosts = filteredPosts.concat(deeplyFilterPosts(node.children[key], allPosts))
    }
    return filteredPosts
  }

  const nowNode = findNodeByFullPath(categoryData, categoryFullName)
  if (!nowNode) {
    return []
  }
  return deeplyFilterPosts(nowNode, allPosts)
}

export const generateStaticParams = async () => {
  function getAllCategoriesFullPath(node: TreeNode, fullPath: string): string[][] {
    const result: string[][] = []
    result.push(node.fullPath.split('/'))

    for (const key in node.children) {
      const child = node.children[key]
      const getChildren = getAllCategoriesFullPath(child, fullPath + node.fullPath + '/')
      result.push(...getChildren)
    }
    return result
  }

  const result: string[][] = getAllCategoriesFullPath(categoryData, categoryData.fullPath)
  return result.map((item) => ({ category: item }))
}

export default async function CategoryPage({ params }: { params: { category: string[] } }) {
  const categoryFullName = params.category.join('/')
  const filteredPosts = sortPosts(filterPosts(categoryFullName, allCoreContent(allBlogs)) as Blog[])
  if (filteredPosts.length === 0) {
    return notFound()
  }
  return (
    <ListLayout
      posts={filteredPosts}
      title={
        categoryFullName == 'blog'
          ? 'All posts'
          : categoryFullName
              .split('/')
              .slice(1)
              .map((item) => (categoryMapping[item] ? categoryMapping[item] : item))
              .join('/')
      }
    />
  )
}
